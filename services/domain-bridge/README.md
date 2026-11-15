# domain-bridge

Puente mínimo entre Supabase y la API de Namecheap para vender dominios desde
CatalogoHoy. Existe porque Namecheap solo acepta llamadas desde IPs en lista
blanca y las edge functions de Supabase no tienen IP fija.

No guarda estado ni decide nada: la edge function `domains` decide qué comprar y
cuándo; este servicio solo traduce a la API XML de Namecheap.

## Endpoints

Todos son `POST` con JSON y el header `x-bridge-secret`. `GET /health` es libre.

| Ruta | Cuerpo | Hace |
| --- | --- | --- |
| `/check` | `{ "domains": ["x.com"] }` | `namecheap.domains.check` (disponible, premium) |
| `/pricing` | `{ "tlds": ["com"] }` | `namecheap.users.getPricing` → costo de registro y renovación en centavos (con cargo ICANN). Cache 6 h |
| `/register` | `{ "domain": "x.com", "years": 1 }` | `namecheap.domains.create` a nombre de CATALOGOHOY, LLC, con privacidad WHOIS |
| `/set-hosts` | `{ "domain": "x.com" }` | `namecheap.domains.dns.setHosts`: A `@` → 76.76.21.21, CNAME `www` → cname.vercel-dns.com |
| `/renew` | `{ "domain": "x.com", "years": 1 }` | `namecheap.domains.renew` |
| `/info` | `{ "domain": "x.com" }` | `namecheap.domains.getInfo` (estado, vencimiento) |
| `/balance` | `{}` | `namecheap.users.getBalances` |

Respuesta: `{ "ok": true, "data": … }` o `{ "ok": false, "error": "…", "code": "…" }`.

## Montarlo en AWS Lightsail (~$5/mes)

1. Lightsail → Create instance → Linux, Ubuntu 24.04, plan de $5.
2. Networking → Create static IP y asignarla a la instancia. Esa es la IP fija.
3. Networking → Firewall: abrir el puerto 443 (o 8787 si no se pone HTTPS).
4. En Namecheap: Profile → Tools → API Access → activar y agregar la IP fija a la lista blanca.
5. En la instancia:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs
   sudo mkdir -p /opt/domain-bridge && sudo chown ubuntu /opt/domain-bridge
   # copiar server.mjs y package.json a /opt/domain-bridge
   sudo cp env.example /etc/domain-bridge.env && sudo chmod 600 /etc/domain-bridge.env
   sudo nano /etc/domain-bridge.env   # llenar valores
   sudo cp domain-bridge.service /etc/systemd/system/
   sudo systemctl enable --now domain-bridge
   ```
6. HTTPS: poner Caddy delante (`sudo apt install caddy`, Caddyfile
   `bridge.catalogohoy.com { reverse_proxy localhost:8787 }`) y un registro A
   `bridge.catalogohoy.com` → IP fija en Route 53.
7. En Supabase, secretos de la edge function `domains`:
   `DOMAIN_BRIDGE_URL=https://bridge.catalogohoy.com`, `DOMAIN_BRIDGE_SECRET=<el mismo BRIDGE_SECRET>`.

## Probar

Con `NAMECHEAP_SANDBOX=1` y una cuenta de sandbox.namecheap.com se puede comprar
sin gastar dinero. `NAMECHEAP_API_URL` permite apuntar a un mock local.
