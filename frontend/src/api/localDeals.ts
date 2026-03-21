export function getDealById(id: string) {
  const deals = [
    {
      deal: "Deal_017",
      spv: "SPV_017",
      location: "Bexar County, TX",
      price: 495000,
      senior: 465300,
      mezz: 20000,
      equity: 29700,
      payment: 1292,
    },
    {
      deal: "Deal_021",
      spv: "SPV_021",
      location: "Atlanta, GA",
      price: 720000,
      senior: 650000,
      mezz: 40000,
      equity: 30000,
      payment: 2100,
    },
  ];

  return deals.find(d => d.deal === id);
}