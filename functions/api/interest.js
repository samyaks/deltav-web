import { saveLead } from "../_lib/lead.js";

export function onRequestPost(context) {
  return saveLead(context.request, context.env.DB);
}
