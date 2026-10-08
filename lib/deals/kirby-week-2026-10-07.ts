// Kirby Foods IGA (Effingham) weekly ad — vision-extracted from the store's
// circular images for the week of 2026-10-07. Source images (public S3):
// https://clintoniga.s3.amazonaws.com/WeeklyAdPdfs/1_10052026_154007.jpg etc.
// This is the v1 seed; the long-term plan is an automated vision pipeline.
export interface KirbyDeal {
  title: string;
  price: string;
  size?: string;
  summary?: string;
  category: string;
}

export const KIRBY_WEEK_START = "2026-10-07";
export const KIRBY_WEEK_END = "2026-10-13";

export const KIRBY_DEALS: KirbyDeal[] = [
  // Page 1 — grocery/produce
  { title: "Boneless Skinless Chicken Breast", price: "$1.99", size: "lb.", summary: "Hot Price!", category: "Meat" },
  { title: "Holiday Seedless Red Grapes", price: "$2.99", size: "lb.", category: "Produce" },
  { title: "Frito-Lay Variety Pack 15-18 ct.", price: "$9.99", summary: "Ad Price $10.99, Digital Coupon -$1.00, Limit 2. Kirby Rewards.", category: "Grocery" },
  { title: "Whole Pork Butt", price: "$1.77", size: "lb.", summary: "Wholestone Farms. Hot Price!", category: "Meat" },
  { title: "Navel Oranges 3 lb. bag", price: "$4.99", category: "Produce" },
  { title: "StarKist Chunk Light Tuna 5 oz.", price: "$0.77", summary: "Ad Price $1.29, Digital Coupon -52¢, Limit 6. Kirby Rewards.", category: "Grocery" },
  { title: "Ragu Pasta Sauce 16-24 oz.", price: "$2.29", summary: "Deal of the Week. Price w/o Digital Deal $2.99. Limit 6 with $10 purchase. Kirby Rewards.", category: "Grocery" },
  { title: "Frito-Lay Party Size Snacks", price: "$4.49", summary: "16 oz. Rold Gold Selects or pre-priced $7.29.", category: "Grocery" },
  { title: "Coffeemate Creamer 14 oz. / 50 oz. / 28-32 oz.", price: "$2.97", summary: "Ad Price $3.99, Digital Coupon -$1.02, Limit 3. Kirby Rewards.", category: "Grocery" },
  { title: "Prairie Farms Milk quart (Whole, 2% or Buttermilk)", price: "$1.59", category: "Dairy" },
  { title: "Prairie Farms Chocolate Milk quart", price: "$1.89", category: "Dairy" },
  { title: "Essential Everyday Butter 16 oz.", price: "2/$4", summary: "Ad Price $2.99, Digital Coupon -99¢, Limit 6. Kirby Rewards.", category: "Dairy" },
  { title: "Stone Ridge Ice Cream Sandwiches 12 ct.", price: "$2.99", summary: "Ad Price $3.99, Digital Coupon -$1.00, Limit 3. Kirby Rewards.", category: "Frozen" },
  { title: "Eckrich Meat Franks 12 oz.", price: "$1.79", summary: "Ad Price $2.39, Digital Coupon -60¢, Limit 3. Kirby Rewards.", category: "Meat" },
  { title: "Kretschmar Cherrywood Smoked Ham (deli)", price: "$4.99", size: "lb.", summary: "Ad Price $6.99 lb., Digital Coupon -$2.00, Limit 2 lbs. Kirby Rewards.", category: "Deli" },
  { title: "Cafe Valley Muffins 4 ct.", price: "$3.99", summary: "Ad Price $5.99, Digital Coupon -$2.00, Limit 2. Kirby Rewards.", category: "Bakery" },
  { title: "Sweet Grape Tomatoes 1 pint", price: "2/$4", summary: "Ad Price $2.88, Digital Coupon -88¢, Limit 2. Kirby Rewards.", category: "Produce" },
  { title: "Culinary Circle Pizza 13.89-28.9 oz.", price: "$3.88", summary: "3 Day Sale! Fri-Sun Oct 9-11. Limit 3. All flavors. Digital Deal. Kirby Rewards.", category: "Frozen" },
  // Meat department
  { title: "85% Lean Ground Chuck Patties", price: "$7.99", size: "lb.", category: "Meat" },
  { title: "85% Lean Ground Chuck", price: "$6.99", size: "lb.", category: "Meat" },
  { title: "T-Bone Steak", price: "$6.99", size: "lb.", summary: "U.S.D.A. Inspected Beef.", category: "Meat" },
  { title: "Boneless Beef Shoulder Roast or Steak", price: "$7.99", size: "lb.", category: "Meat" },
  { title: "Boneless Pork Loin Chops, Roast or Country Style Ribs", price: "$3.99", size: "lb.", summary: "Wholestone Farms.", category: "Meat" },
  { title: "Smithfield Pork Loin Filets or Tenderloins 18.4-23 oz.", price: "$6.49", category: "Meat" },
  { title: "Soules Kitchen Chicken 6 oz.", price: "2/$7", category: "Meat" },
  { title: "Bob Evans Family Size Sides 28-32 oz.", price: "$5.69", category: "Grocery" },
  { title: "Buddig Premium Deli Ham or Turkey 9 oz.", price: "$4.49", category: "Deli" },
  { title: "Johnsonville Party Pack Fresh Brats 38 oz.", price: "$12.99", category: "Meat" },
  { title: "Johnsonville Party Pack Smoked Sausage 28 oz.", price: "$9.49", category: "Meat" },
  { title: "Steidinger Pork Sausage 16 oz. roll", price: "2/$7", category: "Meat" },
  { title: "Smithfield Sliced Quarter Ham 1.5 lb.", price: "$8.99", category: "Meat" },
  // Produce
  { title: "Red, Yellow or Orange Bell Peppers", price: "$1.77", size: "each", category: "Produce" },
  { title: "Green Giant Baby Cut Carrots 1 lb. bag", price: "$1.69", category: "Produce" },
  { title: "Jumbo Sweet Yellow Onions", price: "$1.29", size: "lb.", category: "Produce" },
  { title: "Dole Chopped Salad Kits 9.6-13.6 oz.", price: "$3.99", category: "Produce" },
  { title: "Michigan Apples 3 lb. bag (MacIntosh, Golden or Red Delicious, Gala, Fuji, Jonagold or Jonathan)", price: "$3.99", category: "Produce" },
  { title: "Fresh On the Vine Tomatoes", price: "$2.49", size: "lb.", category: "Produce" },
  // Page 2 — grocery
  { title: "Frito-Lay Baked or PopCorners (pre-priced $4.99)", price: "$3.49", category: "Grocery" },
  { title: "Pringles 4.9-5.57 oz. selected varieties", price: "$2.69", category: "Grocery" },
  { title: "Chef Boyardee Pasta 7.5 oz. bowl or 14.75-15 oz.", price: "3/$4.98", category: "Grocery" },
  { title: "Essential Everyday Potato Chips 9 oz.", price: "2/$5", category: "Grocery" },
  { title: "Essential Everyday Flour 5 lb. (Unbleached or All Purpose)", price: "$2.79", category: "Grocery" },
  { title: "Aunt Millie's Sub Rolls 6-8 ct.", price: "2/$5", category: "Bakery" },
  { title: "Essential Everyday Awesome Strength Paper Towels 8 rolls", price: "$6.99", category: "Household" },
  { title: "Zatarain's Rice Mix 7-8 oz.", price: "$2.29", category: "Grocery" },
  { title: "Campbell's Condensed Soup 10.5-11.25 oz.", price: "$1.79", category: "Grocery" },
  { title: "Essential Everyday Salad Dressing 16 oz.", price: "2/$5", category: "Grocery" },
  { title: "Aunt Millie's Giant White Bread 22 oz.", price: "$2.19", category: "Bakery" },
  { title: "Dove Shampoo or Conditioner 12 oz.", price: "$5.99", category: "Health & Beauty" },
  { title: "Edge or Skintimate Shave Gel 7 oz.", price: "$3.79", category: "Health & Beauty" },
  // Chili fixin's
  { title: "Essential Everyday Kidney or Chili Beans 15 oz.", price: "5/$5", category: "Grocery" },
  { title: "Essential Everyday Tomatoes 14.5-15 oz.", price: "5/$5", category: "Grocery" },
  { title: "Essential Everyday Tomato Juice 46 oz.", price: "$2.29", category: "Grocery" },
  { title: "Essential Everyday Saltine Crackers 16 oz.", price: "2/$5", category: "Grocery" },
  { title: "McCormick Chili Seasoning Mix 1.25 oz.", price: "4/$5", category: "Grocery" },
  { title: "McCormick Seasoning Mix .81-2.11 oz.", price: "2/$4", category: "Grocery" },
  { title: "McCormick Gravy Mix .75-2.64 oz.", price: "4/$5", category: "Grocery" },
  { title: "McCormick Brown Gravy Mix .87 oz.", price: "$0.99", category: "Grocery" },
  // Dairy & frozen
  { title: "Essential Everyday Shredded or Chunk Cheese 6-8 oz.", price: "$2.29", category: "Dairy" },
  { title: "Essential Everyday Sour Cream 16 oz.", price: "2/$4", category: "Dairy" },
  { title: "Stone Ridge Ice Cream 48 oz.", price: "$3.77", category: "Frozen" },
  { title: "Birds Eye Steamfresh Vegetables 10-10.8 oz.", price: "2/$3", category: "Frozen" },
  { title: "Culinary Circle Rising Crust Pizza 13.95-28.9 oz.", price: "$4.88", category: "Frozen" },
  { title: "Yoplait Go-Gurt 8 ct.", price: "$2.69", category: "Dairy" },
  { title: "Oikos Triple Zero Greek Yogurt 5.3 oz.", price: "2/$3", category: "Dairy" },
  { title: "New York Texas Toast or 3 Cheese Breadsticks 7.3-13.5 oz.", price: "2/$7", category: "Frozen" },
  { title: "Eggo Family Pack Waffles or Pancakes 24 ct.", price: "$5.99", category: "Frozen" },
  // Deli
  { title: "Kretschmar Off the Bone Turkey (Smoked or Honey)", price: "$9.99", size: "lb.", category: "Deli" },
  { title: "Kretschmar Colby or Colby Jack Cheese", price: "$7.99", size: "lb.", category: "Deli" },
  { title: "Reser's Mashed Potatoes & Gravy", price: "$2.99", size: "lb.", category: "Deli" },
  { title: "Kirby's Signature Fresh Made Tortilla Chips 14-16 oz.", price: "$2.99", category: "Deli" },
  { title: "Gordo's Cheese Dip 16 oz.", price: "$5.99", category: "Deli" },
  // Flowers
  { title: "3 Pink Roses in a Vase", price: "$22.99", summary: "Flowers by Kirby.", category: "Floral" },
  { title: "Pumpkin Blooms Bouquet", price: "$10.99", summary: "Flowers by Kirby.", category: "Floral" },
  { title: '6" Orange Color Theory Plants', price: "$13.99", summary: "Flowers by Kirby.", category: "Floral" },
  // Bakery
  { title: "Companion Everyday Twin Italian Bread 18 oz.", price: "$3.49", category: "Bakery" },
  { title: "Kirby's Signature Fresh Baked Premium Cookies 10 ct.", price: "$5.00", category: "Bakery" },
  { title: "The Father's Table 2 Slice Cheesecake 6 oz.", price: "2/$6", category: "Bakery" },
];
