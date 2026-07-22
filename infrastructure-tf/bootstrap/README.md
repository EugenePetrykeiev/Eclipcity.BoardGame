# Remote Terraform state

The state bucket is bootstrapped outside Terraform because Terraform cannot use a
bucket before that bucket exists. The script derives the AWS account ID, creates
one globally unique S3 bucket, blocks all public access, enables versioning and
server-side encryption, denies non-TLS access, and writes an ignored
`dev/backend.hcl` file.

```bash
aws login
AWS_REGION=eu-central-1 ./infrastructure-tf/bootstrap/bootstrap-state.sh
terraform -chdir=infrastructure-tf/dev init -backend-config=backend.hcl
```

Terraform uses S3 native lock files (`use_lockfile = true`). A DynamoDB lock table
is intentionally not created because DynamoDB-based locking is deprecated for the
S3 backend.
