/** How a visitor reaches sales. One place, so the number never drifts between pages. */
export const WHATSAPP_NUMBER_DISPLAY = "+44 7442 301733";

const WHATSAPP_NUMBER = "447442301733";
const WHATSAPP_GREETING = "Hi, I'd like a demo of Alayn for my restaurant.";

/** Opens a WhatsApp chat with sales, with the first message already typed. */
export const WHATSAPP_HREF = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_GREETING)}`;
