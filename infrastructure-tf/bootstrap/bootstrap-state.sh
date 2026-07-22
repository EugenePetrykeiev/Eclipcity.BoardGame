#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-eu-central-1}"
PROJECT="${PROJECT:-eclipcity}"
ENVIRONMENT="${ENVIRONMENT:-dev}"

if ! command -v aws >/dev/null 2>&1; then
  echo "Required command is missing: aws" >&2
  exit 1
fi

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
BUCKET_NAME="${TF_STATE_BUCKET:-${PROJECT}-terraform-state-${ACCOUNT_ID}-${AWS_REGION}}"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
INFRASTRUCTURE_DIR="$(dirname -- "${SCRIPT_DIR}")"
BACKEND_FILE="${INFRASTRUCTURE_DIR}/${ENVIRONMENT}/backend.hcl"

if aws s3api head-bucket --bucket "${BUCKET_NAME}" 2>/dev/null; then
  echo "Using existing state bucket: ${BUCKET_NAME}"
else
  echo "Creating state bucket: ${BUCKET_NAME}"
  if [[ "${AWS_REGION}" == "us-east-1" ]]; then
    aws s3api create-bucket \
      --bucket "${BUCKET_NAME}" \
      --region "${AWS_REGION}"
  else
    aws s3api create-bucket \
      --bucket "${BUCKET_NAME}" \
      --region "${AWS_REGION}" \
      --create-bucket-configuration "LocationConstraint=${AWS_REGION}"
  fi
fi

aws s3api put-public-access-block \
  --bucket "${BUCKET_NAME}" \
  --public-access-block-configuration \
  'BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true'

aws s3api put-bucket-versioning \
  --bucket "${BUCKET_NAME}" \
  --versioning-configuration Status=Enabled

aws s3api put-bucket-encryption \
  --bucket "${BUCKET_NAME}" \
  --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"},"BucketKeyEnabled":false}]}'

aws s3api put-bucket-tagging \
  --bucket "${BUCKET_NAME}" \
  --tagging "TagSet=[{Key=Project,Value=${PROJECT}},{Key=ManagedBy,Value=bootstrap-state.sh},{Key=Purpose,Value=terraform-state}]"

POLICY_FILE="$(mktemp)"
LIFECYCLE_FILE="$(mktemp)"
trap 'rm -f "${POLICY_FILE}" "${LIFECYCLE_FILE}"' EXIT

cat > "${POLICY_FILE}" <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyInsecureTransport",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": [
        "arn:aws:s3:::${BUCKET_NAME}",
        "arn:aws:s3:::${BUCKET_NAME}/*"
      ],
      "Condition": {
        "Bool": {
          "aws:SecureTransport": "false"
        }
      }
    }
  ]
}
EOF

aws s3api put-bucket-policy \
  --bucket "${BUCKET_NAME}" \
  --policy "file://${POLICY_FILE}"

cat > "${LIFECYCLE_FILE}" <<'EOF'
{
  "Rules": [
    {
      "ID": "retain-noncurrent-state-versions",
      "Status": "Enabled",
      "Filter": {"Prefix": ""},
      "NoncurrentVersionExpiration": {"NoncurrentDays": 365},
      "AbortIncompleteMultipartUpload": {"DaysAfterInitiation": 7}
    }
  ]
}
EOF

aws s3api put-bucket-lifecycle-configuration \
  --bucket "${BUCKET_NAME}" \
  --lifecycle-configuration "file://${LIFECYCLE_FILE}"

cat > "${BACKEND_FILE}" <<EOF
bucket       = "${BUCKET_NAME}"
key          = "${PROJECT}/${ENVIRONMENT}/terraform.tfstate"
region       = "${AWS_REGION}"
encrypt      = true
use_lockfile = true
EOF

chmod 0600 "${BACKEND_FILE}"

echo "Remote state is ready."
echo "Backend config: ${BACKEND_FILE}"
echo "Next: terraform -chdir=${INFRASTRUCTURE_DIR}/${ENVIRONMENT} init -backend-config=backend.hcl"
