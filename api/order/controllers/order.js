"use strict";
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

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

    console.log("cart: ", cart);

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

    console.log("validatedCart", validatedCart);
    // //Use the data from strapi to calculate the price of each product
    // //Basically calculate the total that way

    total = strapi.config.functions.cart.cartTotal(validatedCart);

    console.log("total", total);

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
};
