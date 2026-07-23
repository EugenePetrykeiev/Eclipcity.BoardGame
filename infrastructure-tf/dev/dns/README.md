# DNS through adm.tools API

The authoritative zone is `digitee.space` (`domain_id=1579290`). The application
name `dev.eclipcity.digitee.space` is a subdomain record in that zone, not a new
domain registration.

The provider exposes a JSON API at `https://adm.tools/action/dns/`. The current
workflow uses these endpoints:

- `list` — discover available zones and verify the expected domain ID;
- `records_list` — read current records;
- `record_add` — add a missing desired record;
- `record_edit` — update a unique existing record.

The API token remains in AWS Secrets Manager under:

```text
arn:aws:secretsmanager:eu-central-1:396287094980:secret:eclipcity/dev/dns-PfFhVn
```

The secret JSON contract is `{"adm_api":"..."}`. Never put this value in
Terraform variables, state, shell history, or Git.

After `terraform apply`, print the records:

```bash
./infrastructure-tf/dev/dns/export-records.sh
```

Preview API actions without mutation:

```bash
./infrastructure-tf/dev/dns/sync-records.sh plan
```

Apply only after reviewing the plan:

```bash
./infrastructure-tf/dev/dns/sync-records.sh apply
```

The first record points `dev.eclipcity.digitee.space` to the frontend Elastic IP.
The remaining records verify the SES identity, DKIM, and custom MAIL FROM domain.
After propagation, verify the application A record:

```bash
./infrastructure-tf/dev/dns/check-dns.sh
```

The script is intentionally separate from Terraform: the adm.tools token never
enters Terraform state, API failure cannot leave an apparently successful
Terraform resource, and DNS changes always require an explicit command. It never
deletes records and refuses to mutate anything outside
`dev.eclipcity.digitee.space`.

After propagation, run `check-dns.sh`. Do not start the first automatic deployment
until the A record resolves to the expected Elastic IP; its frontend stage will
request the Certbot certificate through HTTP-01. Hosting Ukraine documents the
same Bearer-authenticated DNS endpoints:
https://www.ukraine.com.ua/wiki/vps/administration/certbot/
