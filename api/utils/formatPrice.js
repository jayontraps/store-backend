//Credits to: https://stackoverflow.com/questions/149055/how-to-format-numbers-as-currency-string
/**
 * Formats a integer price into a price with decimals with a preceding $ sign
 * @parmas {string} - priceWithDecimals representation of price
 */

module.exports = {
  formatPrice: (priceWithDecimals) => {
    if (!priceWithDecimals) {
      return null;
    }

    const realPrice = parseInt(priceWithDecimals) / 100;
    return realPrice.toLocaleString("en-GB", {
      style: "currency",
      currency: "GBP",
    });
  },
};
