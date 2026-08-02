import { json } from "@remix-run/node";

export const loader = () => {
  return json({ ok: true, service: "shopigent-returns", status: "healthy" });
};

export const action = () => {
  return json({ ok: true, service: "shopigent-returns", status: "healthy" });
};