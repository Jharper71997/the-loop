-- Migration 023: replace seeded waiver with full passenger liability waiver.
--
-- Bumps to version 2 with requires_resign=true. The legal text materially
-- expands beyond the v1 seed (NC governing law, indemnification, cleaning
-- fee policy, medical fitness, etc.), so prior signers must re-sign before
-- their next ride.
--
-- Run in Supabase SQL Editor. Idempotent: re-runs are no-ops once v2 exists.

insert into public.waiver_versions (version, body_md, requires_resign)
select 2,
$$PASSENGER LIABILITY WAIVER AND RELEASE

This Passenger Liability Waiver and Release ("Waiver") is entered into by the undersigned passenger ("Passenger") in favor of JVILLE BREW LOOP, its owners, members, officers, directors, employees, drivers, contractors, agents, and insurers (collectively, the "Company").

1. Assumption of Risk

Passenger acknowledges and understands that transportation by bus or motor coach involves inherent risks, including but not limited to traffic accidents, sudden stops, mechanical failures, road conditions, weather conditions, acts of third parties, and passenger conduct. Passenger voluntarily assumes all such risks, whether known or unknown, foreseeable or unforeseeable, arising out of or related to the transportation services provided by the Company.

2. Release and Waiver

To the fullest extent permitted by North Carolina law, Passenger hereby releases, waives, discharges, and covenants not to sue the Company from any and all claims, demands, causes of action, damages, losses, liabilities, costs, or expenses of any kind, whether in law or equity, arising from or related to Passenger's use of the Company's transportation services, including but not limited to claims for personal injury, bodily injury, illness, death, or property damage, except to the extent caused by the Company's gross negligence or willful or wanton misconduct.

3. Negligence

Passenger expressly understands and agrees that this Waiver includes a release of claims based on the ordinary negligence of the Company, its employees, or agents, but does not apply to claims that cannot be waived under North Carolina law.

4. Compliance With Rules and Safety Instructions

Passenger agrees to comply with all posted rules, driver instructions, safety requirements, and applicable laws and regulations while using the Company's services. Failure to comply may result in removal from the vehicle without refund and may void coverage or protections otherwise available. Additional charges may apply for unnecessary cleaning of the vehicle.

5. Medical Fitness

Passenger represents that they are physically and medically able to safely participate in bus transportation and do not have any condition that would pose a risk to themselves or others during travel. Passengers assume all responsibility for any medical conditions or emergencies arising during transport.

6. Personal Property

Passenger understands that the Company is not responsible for loss, theft, or damage to Passenger's personal property, including luggage, carry-on items, or valuables, except as required by applicable law.

7. Indemnification

Passenger agrees to indemnify, defend, and hold harmless the Company from any claims, liabilities, damages, or expenses (including reasonable attorneys' fees) arising from Passenger's own acts, omissions, or violations of this Waiver.

8. Governing Law and Venue

This Waiver shall be governed by and construed in accordance with the laws of the State of North Carolina. Any legal action arising out of this Waiver shall be brought exclusively in a court of competent jurisdiction located within North Carolina.

9. Severability

If any provision of this Waiver is held to be invalid or unenforceable, the remaining provisions shall remain in full force and effect.

10. Cleaning Fee Policy

Passengers may be assessed a cleaning fee of up to $400 for incidents involving vomiting, bodily fluids, or excessive mess requiring specialized cleaning. The fee reflects cleaning costs, sanitation, odor removal, and potential loss of service. The Company reserves the right to charge the card on file or pursue reimbursement if payment is not made at the time of service.

11. Entire Agreement

This Waiver constitutes the entire agreement between Passenger and the Company regarding liability and risk assumption and supersedes all prior or contemporaneous agreements or representations, whether written or oral.

PASSENGER ACKNOWLEDGMENT

By signing below, Passenger acknowledges that they have read this Waiver carefully, understand its terms, understand that they are giving up substantial legal rights, and sign it voluntarily and without coercion.$$,
true
where not exists (select 1 from public.waiver_versions where version = 2);
