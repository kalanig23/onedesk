// Indian format: 2,74,000
export const rupees = (n) => "₹" + Math.round(n).toLocaleString("en-IN");
export const num = (n) => (Math.round(n * 10) / 10).toLocaleString("en-IN");