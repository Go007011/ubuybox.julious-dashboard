export const documents = [
  {
    dealId: "017",
    spv: "SPV_017",
    docs: [
      {
        name: "Operating Agreement",
        type: "PDF",
        url: "/docs/spv_017_operating_agreement.pdf",
      },
      {
        name: "Capital Stack Breakdown",
        type: "PDF",
        url: "/docs/spv_017_cap_stack.pdf",
      },
      {
        name: "Subscription Agreement",
        type: "PDF",
        url: "/docs/spv_017_subscription.pdf",
      },
      {
        name: "Seller Carryback Note",
        type: "PDF",
        url: "/docs/spv_017_note.pdf",
      },
    ],
  },
];

export function getDocumentsByDealId(id: string) {
  return documents.find((d) => d.dealId === id);
}