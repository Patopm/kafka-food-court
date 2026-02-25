# Deployment Guide (Public Client + Dashboard, Local Kitchens)

## Terraform-first workflow

AWS resources are now defined in:

- [`infra/terraform`](/Users/patopina/kafka-food-court/infra/terraform)

Use this flow for simpler deployment/rollback:

```bash
cd infra/terraform
terraform init
cp terraform.tfvars.example terraform.tfvars
# edit terraform.tfvars
terraform plan
```

Important Terraform inputs for your kitchen requirement:

- `kitchen_instances`: list of published kitchen examples.
- `kitchen_ui_allowed_cidrs`: only these CIDRs can open kitchen UIs.

Do not run `terraform apply` until you are ready.

Rollback is done by setting `app_git_ref` in `terraform.tfvars` to a previous tag/commit and applying that change later.

This guide is optimized for the current codebase and your goal:

- `client-app` and `dashboard` are public on the internet.
- `kitchen-app` is also published with multiple examples, but access-restricted to only your CIDR(s).
- You can still run additional kitchens locally if needed.
- Kafka is shared so all kitchens process real public orders.
- Persistent state (users, sessions, orders, reactions) survives reload/restarts.

## Why this deployment target

For this repo **today**, the best-supported path is **AWS EC2 + Docker Compose** because:

- the apps already run cleanly in this model,
- kitchens can connect remotely to one broker,
- the new shared DB file can be persisted on a mounted host volume,
- setup is fast and predictable for demos.

## Final architecture

- AWS EC2 (Ubuntu) hosts:
  - Kafka broker
  - Kafka UI (optional)
  - `client-app` (port 3000)
  - `dashboard` (port 3002)
  - shared DB file at `/opt/kafka-food-court/data/food-court-db.json`
- Nginx reverse proxy:
  - `/` -> `client-app`
  - `/dashboard/` -> `dashboard`
  - `/kitchens/<kitchen-id>/` -> kitchen instances (CIDR-restricted)
- Optional: your local machine can host extra `kitchen-app` instances connecting to the same broker.

## 1. Create the EC2 host

1. Launch EC2 Ubuntu 22.04 (minimum `t3.medium`, recommended `t3.large`).
2. Security Group inbound rules:
   - `22` from your IP
   - `80` from `0.0.0.0/0`
   - `443` from `0.0.0.0/0`
   - `29092` from your home/office public IP (for local kitchens)
   - optional `8080` from your IP (Kafka UI)
3. Attach an Elastic IP (recommended).

## 2. Install runtime on EC2

```bash
sudo apt update
sudo apt install -y git docker.io docker-compose-plugin nginx
sudo usermod -aG docker $USER
newgrp docker
```

Install Bun:

```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
```

## 3. Clone and configure

```bash
cd /opt
sudo mkdir -p kafka-food-court
sudo chown $USER:$USER kafka-food-court
cd kafka-food-court
git clone <your-repo-url> .
bun install
mkdir -p data
```

Create env files:

```bash
cp apps/client-app/env.example apps/client-app/.env.local
cp apps/dashboard/env.example apps/dashboard/.env.local
cp apps/kitchen-app/env.example apps/kitchen-app/.env.local
```

Set these values:

- `apps/client-app/.env.local`
  - `KAFKA_BROKER=<EC2_PUBLIC_DNS>:29092`
  - `DB_FILE_PATH=/opt/kafka-food-court/data/food-court-db.json`
- `apps/dashboard/.env.local`
  - `KAFKA_BROKER=<EC2_PUBLIC_DNS>:29092`
  - `DB_FILE_PATH=/opt/kafka-food-court/data/food-court-db.json`

If you run kitchen on EC2 too, set the same values in its env.

## 4. Kafka advertised listener for remote kitchens

Edit `docker-compose.yml` on EC2 and replace `localhost:29092` in `KAFKA_ADVERTISED_LISTENERS` with your public DNS:

```yaml
KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092,PLAINTEXT_HOST://<EC2_PUBLIC_DNS>:29092
```

Then start Kafka and create topics:

```bash
docker compose up -d
./scripts/init-topics.sh
```

## 5. Run public apps

Use two terminals (or tmux/systemd):

```bash
bun run dev:client
bun run dev:dashboard
```

For production-style startup instead of dev:

```bash
bun --filter client-app run build
bun --filter dashboard run build
bun --filter client-app run start
bun --filter dashboard run start
```

## 6. Configure Nginx + TLS

Create `/etc/nginx/sites-available/kafka-food-court`:

```nginx
server {
  server_name client.yourdomain.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
  }
}

server {
  server_name dashboard.yourdomain.com;

  location / {
    proxy_pass http://127.0.0.1:3002;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
  }
}
```

Enable it:

```bash
sudo ln -s /etc/nginx/sites-available/kafka-food-court /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

Install TLS certificates:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d client.yourdomain.com -d dashboard.yourdomain.com
```

## 7. Published kitchens (restricted access)

Terraform now publishes multiple kitchen examples automatically:

- `http://<server>/kitchens/kitchen-a/`
- `http://<server>/kitchens/kitchen-b/`
- `http://<server>/kitchens/kitchen-c/` (if configured)

Only CIDRs in `kitchen_ui_allowed_cidrs` can access these routes.

## 8. Optional: run extra kitchens locally (your machine)

On your local machine:

```bash
cp apps/kitchen-app/env.example apps/kitchen-app/.env.local
```

Set:

- `KAFKA_BROKER=<EC2_PUBLIC_DNS>:29092`
- `KITCHEN_ID=kitchen-local-1`
- `NEXT_PUBLIC_KITCHEN_NAME=Kitchen Local 1`

Run:

```bash
bun run dev:kitchen
```

You can start multiple kitchen instances with different `KITCHEN_ID` values for partition rebalancing demos.

## 9. Verify end-to-end

1. Open `https://client.yourdomain.com`.
2. Register a user and place orders.
3. Open `https://dashboard.yourdomain.com` and confirm metrics/logs update.
4. Process orders in local kitchen and confirm status updates in client/dashboard.
5. Refresh client/dashboard and confirm data persists.

## Persistence details

Current implementation stores data in a shared JSON DB file:

- users (login/register)
- sessions
- orders
- reactions

Path is controlled by `DB_FILE_PATH` and must be identical for `client-app` and `dashboard`.

## Recommended hardening (next step)

1. Move Kafka to Amazon MSK (or Confluent Cloud) and disable public broker access.
2. Replace JSON DB with Amazon RDS PostgreSQL.
3. Put apps behind AWS ALB with ECS/App Runner.
4. Add WAF + rate limiting on auth routes.
