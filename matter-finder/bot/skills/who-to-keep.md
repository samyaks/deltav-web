---
description: Use when deciding which public pages to read and which law-firm operators to save.
---

# Who to keep

Read pages one at a time with `fetch-public-page`. Save a person with `save-person` only from a page you just fetched.

## Pages to open

1. ILTACON agenda: `https://www.iltacon.org/iltacon/agenda/overview` and the ILTA daily write-ups linked from `https://www.iltanet.org/`. Keep law-firm speakers from sessions on knowledge and AI, innovation leadership, time capture, and legal AI tools.
2. Pricing and profitability faculty pages on `https://www.sandpiperpartners.com/` for the Profitability, Pricing and AI meetings.
3. Legal Value Network profiles on `https://www.legalvaluenetwork.com/`.
4. Customer stories on `https://www.harvey.ai/customers` and public Legora customer write-ups. Open the named person's firm bio next.
5. The firm bio linked from those pages. That bio is where a published work email usually sits.

## Keep

- Director or chief of innovation, knowledge management, legal technology, or AI. Role `ai_seats`.
- Director of pricing, pricing and legal project management, practice management, chief operating officer, or chief financial officer. Role `matter_economics`.

## Skip

- Anyone employed by a company that sells software.
- Associates, interns, students, recruiters, paralegals, and consultants.
- A managing partner or practicing lawyer with no innovation, pricing, or operations title, unless the firm is small and the page shows they own the AI rollout or the fee.

## After each page

Save the matches. Call `list-people`. Continue with the next public page until the list has 100 people or the user says to stop.

Do not open LinkedIn. Do not invent an email. Do not write a message.
