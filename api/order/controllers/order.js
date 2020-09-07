"use strict";
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { sanitizeEntity } = require("strapi-utils");
const { formatPrice } = require("../../utils/formatPrice");
const SHIPPING_RATE = process.env.SHIPPING_RATE || 350;

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */

module.exports = {
  setUpStripe: async (ctx) => {
    let total = 100;
    let validatedCart = [];
    let receiptCart = [];

    //Through ctx.request.body
    //We will receive the products and the qty
    const { cart } = ctx.request.body;

    // console.log("cart: ", cart);

    await Promise.all(
      cart.map(async (product) => {
        const validatedProduct = await strapi.services.product.findOne({
          id: product.id,
        });

        if (validatedProduct) {
          validatedProduct.qty = product.qty;

          validatedCart.push(validatedProduct);

          receiptCart.push({
            id: product.id,
            qty: product.qty,
          });
        }

        return validatedProduct;
      })
    );

    // console.log("validatedCart", validatedCart);
    // //Use the data from strapi to calculate the price of each product
    // //Basically calculate the total that way

    total = strapi.config.functions.cart.cartTotal(validatedCart);

    // console.log("total", total);

    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: total,
        currency: "gbp",
        // Verify your integration in this guide by including this parameter
        metadata: { cart: JSON.stringify(receiptCart) },
      });

      return paymentIntent;
    } catch (err) {
      return { error: err.raw.message };
    }
  },
  create: async (ctx) => {
    const {
      paymentIntent,

      shipping_name,
      email,
      shipping_address,
      shipping_state,
      shipping_country,
      shipping_zip,

      cart,
    } = ctx.request.body;

    //Payment intent for validation
    let paymentInfo;

    try {
      paymentInfo = await stripe.paymentIntents.retrieve(paymentIntent.id);
      if (paymentInfo.status !== "succeeded") {
        throw { message: "You still have to pay" };
      }
    } catch (err) {
      ctx.response.status = 402;
      return { error: err.message };
    }

    //Check if paymentIntent was not already used to generate an order
    const alreadyExistingOrder = await strapi.services.order.find({
      payment_intent_id: paymentIntent.id,
    });

    console.log("alreadyExistingOrder: ", alreadyExistingOrder);

    if (alreadyExistingOrder && alreadyExistingOrder.length > 0) {
      ctx.response.status = 402;
      return { error: "This payment intent was already used" };
    }

    const payment_intent_id = paymentIntent.id;

    console.log("payment_intent_id: ", payment_intent_id);
    //Check if the data is proper
    // console.log("order.create cart", cart);
    let product_qty = [];
    let products = [];
    let sanitizedCart = [];

    //Fetch the products and add them to the products array, also set up product_qty
    await Promise.all(
      cart.map(async (product) => {
        const foundProduct = await strapi.services.product.findOne({
          id: product.strapiId,
        });

        if (foundProduct) {
          product_qty.push({
            id: product.strapiId,
            qty: product.qty,
          });

          products.push(foundProduct);

          sanitizedCart.push({ ...foundProduct, ...{ qty: product.qty } });
        }

        return foundProduct;
      })
    );

    // console.log("order.create product_qty", product_qty);
    // console.log("order.create products", products);
    // console.log("order.create sanitizedCart", sanitizedCart);

    let subtotal = parseInt(
      strapi.config.functions.cart.cartSubtotal(sanitizedCart)
    );
    // console.log("subtotal", subtotal);
    let taxes = parseInt(strapi.config.functions.cart.cartTaxes(sanitizedCart));
    // console.log("taxes", taxes);
    let total = parseInt(strapi.config.functions.cart.cartTotal(sanitizedCart));
    // console.log("total", total);

    if (paymentInfo.amount !== total) {
      ctx.response.status = 402;
      return {
        error:
          "The total to be paid is different from the total from the Payment Intent",
      };
    }

    // create a customer facing order id
    const customer_order_id = Date.now().toString().slice(6, 13);

    const entry = {
      shipping_name,
      email,
      shipping_address,
      shipping_state,
      shipping_country,
      shipping_zip,

      product_qty,
      products,

      subtotal,
      taxes,
      total,
      customer_order_id,
      payment_intent_id,
    };

    const shipping_cost = formatPrice(SHIPPING_RATE);

    const entity = await strapi.services.order.create(entry);

    var today = new Date();
    var dd = String(today.getDate()).padStart(2, "0");
    var mm = String(today.getMonth() + 1).padStart(2, "0"); //January is 0!
    var yyyy = today.getFullYear();

    today = dd + "/" + mm + "/" + yyyy;

    const Sender_Name = "Ply Coasters";
    const Sender_Address = "Sylvan Road";
    const Sender_City = "London";
    const Sender_Zip = "SE19 2RX";

    const emailData = {
      products: sanitizedCart.map((product) => ({
        name: product.name,
        image: product.thumbnail.formats.thumbnail.url,
        price: formatPrice(product.price),
        quantity: product.qty,
      })),
      shipping_address: `${shipping_address}, ${shipping_state}, ${shipping_country}, ${shipping_zip}`,
      order_date: today,
      email,
      shipping_name,
      shipping_cost,
      subtotal: formatPrice(subtotal),
      taxes: formatPrice(taxes),
      total: formatPrice(total),
      customer_order_id,
      Sender_Name,
      Sender_Address,
      Sender_City,
      Sender_Zip,
    };

    console.log("emailData: ", emailData);

    const adminMsg = `Order received on ${today}. Order number ${customer_order_id}`;

    // send email notifying admin of purchase
    const adminEmail = await strapi.plugins["email"].services.email.send({
      to: process.env.SENDGRID_ADMIN,
      from: process.env.SENDGRID_DEFAULT_FROM,
      replyTo: process.env.SENDGRID_DEFAULT_FROM,
      subject: "Order received",
      text: adminMsg,
      html: adminMsg,
    });

    console.log("adminEmail: ", adminEmail);

    // send order confirmation to customer
    const customerEmail = await strapi.plugins["email"].services.email.send({
      to: email,
      from: process.env.SENDGRID_DEFAULT_FROM,
      replyTo: process.env.SENDGRID_DEFAULT_FROM,
      subject: "Order received",
      text: "Thank you world!",
      html: "Thank you world!",
      dynamic_template_data: emailData,
      template_id: "d-94c52df148df4b76a6ea6596c997206a",
    });
    console.log("customerEmail: ", customerEmail);

    return sanitizeEntity(entity, { model: strapi.models.order });
  },
};
