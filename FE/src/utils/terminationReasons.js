// Why a contract ends (mirrors BE contractSettlementService.TERMINATION_REASONS).
export const TERMINATION_REASONS = {
  EXPIRED: {
    label: "Hết hạn hợp đồng",
    hint: "Trả phòng từ ngày kết thúc hợp đồng trở đi. Hoàn cọc sau khi trừ các khoản còn nợ.",
  },
  MUTUAL: {
    label: "Hai bên thỏa thuận chấm dứt",
    hint: "Chấm dứt theo thỏa thuận (trước hoặc sau hạn). Hoàn cọc sau khi trừ các khoản còn nợ.",
  },
  TENANT_EARLY: {
    label: "Khách trả phòng trước hạn, có báo trước",
    hint: "Khách báo trước đúng thời hạn trong hợp đồng. Hoàn cọc sau khi trừ các khoản còn nợ.",
  },
  TENANT_BREACH: {
    label: "Khách vi phạm / tự ý bỏ đi không báo trước",
    hint: "Theo điều khoản tiền cọc, chủ trọ được giữ lại phần cọc còn lại sau khi trừ nợ.",
  },
  LANDLORD_EARLY: {
    label: "Chủ trọ chấm dứt trước hạn",
    hint: "Chủ trọ đơn phương chấm dứt: hoàn lại toàn bộ phần cọc còn lại cho khách.",
  },
};
