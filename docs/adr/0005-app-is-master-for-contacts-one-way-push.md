# The app is the master for Contacts; Bigin and Zoho Books receive one-way pushes

**Contacts** are created and edited only in the app. The app pushes each new or changed **Contact** one way to Bigin, which stays in use for leads and marketing, and to Zoho Books when a **Quote** or invoice needs it. Neither system's edits are pulled back. Bigin stops tracking **Jobs**: that moves to the app.

## Considered Options

- Two-way sync between the app, Bigin and Zoho Books: rejected. With three systems able to edit the same phone number we would spend most of the integration effort on conflicts, duplicates and silent overwrites.
- Retire Bigin entirely: rejected, because Bigin is still used for leads and marketing.

## Consequences

Staff must be told not to edit customer details in Bigin or Zoho Books. Any edits made there will be overwritten on the next push. At launch, Contacts are imported once from Bigin and Zoho Books (matched on phone number), along with open **Jobs** only.
