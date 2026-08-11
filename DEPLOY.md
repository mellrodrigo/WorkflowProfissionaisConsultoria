# Deploy em VPS (Hostinger)

Guia para publicar a aplicação em um VPS Ubuntu/Debian, com HTTPS e domínio próprio.
Os comandos são para colar no terminal do VPS (console do hPanel ou SSH), na ordem.

O domínio deste projeto é **iadasilva.com.br** (com `www` redirecionando para ele),
e os arquivos em `deploy/` já vêm preenchidos com esse valor.

Ao longo do guia, substitua `SEU_IP` pelo IP do VPS.

> **Requisito**: Node.js 22 ou superior (a aplicação usa o SQLite embutido do Node).
> Não funciona em hospedagem compartilhada — precisa ser VPS.

---

## 1. Apontar o domínio para o VPS

Este é o passo que mais causa confusão na Hostinger: um domínio pode estar
apontado para a **hospedagem compartilhada** em vez do **VPS**. Nesse caso a
aplicação sobe normalmente no VPS, mas o site responde **403 Forbidden** — que é
o compartilhado servindo um `public_html` vazio.

Descubra o IP do VPS (no hPanel, em VPS → Visão geral) e compare com o que o
domínio resolve hoje:

```bash
dig +short iadasilva.com.br A
dig +short iadasilva.com.br AAAA
```

Se o resultado **não** for o IP do VPS, ajuste no painel de DNS do domínio:

| Tipo | Nome | Valor |
| --- | --- | --- |
| `A` | `@` | IP **IPv4** do VPS |
| `A` | `www` | IP **IPv4** do VPS |
| `AAAA` | `@` | IP **IPv6** do VPS (se houver; caso contrário, remova o registro) |
| `AAAA` | `www` | IP **IPv6** do VPS (idem) |

> Um `AAAA` apontando para o servidor errado quebra o acesso mesmo com o `A`
> correto, porque navegadores preferem IPv6. Se o VPS não tem IPv6, **apague**
> os registros `AAAA` em vez de deixá-los apontando para outro lugar.

A propagação leva de minutos a algumas horas. Só siga para o passo 6 (SSL)
quando os comandos acima retornarem o IP do VPS — o certbot falha se o domínio
ainda estiver apontando para outro servidor.

---

## 2. Preparar o servidor

```bash
# Como root
apt update && apt upgrade -y
apt install -y curl git nginx sqlite3

# Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
node --version   # deve mostrar v22.x ou superior
```

Crie um usuário sem privilégios para rodar a aplicação — não rode como root:

```bash
adduser --system --group --home /opt/workflow-ntt workflow
```

---

## 3. Publicar o código

```bash
git clone https://github.com/mellrodrigo/WorkflowProfissionaisConsultoria.git /opt/workflow-ntt
cd /opt/workflow-ntt

npm install     # instala server e client (via postinstall)
npm run build   # gera o frontend

chown -R workflow:workflow /opt/workflow-ntt
```

> **Painéis de deploy automatizado** (como o da Hostinger) costumam rodar
> `npm install` seguido de `npm run build` na raiz — os dois comandos acima.
> Ambos já se viram sozinhos: o `postinstall` da raiz instala as dependências
> de `server` e `client`, e o `build` garante as do `client` antes de compilar,
> inclusive quando `NODE_ENV=production` (o Vite é uma devDependency e seria
> ignorado por um `npm install` comum nesse modo).

---

## 4. Criar o primeiro usuário de acesso

A aplicação exige login. Sem este passo ninguém entra.

```bash
cd /opt/workflow-ntt/server
sudo -u workflow npm run create-user -- rodrigo 'UMA_SENHA_FORTE' 'Rodrigo Mello'
```

Use uma senha longa e única (mínimo 8 caracteres; recomendo 16+). O mesmo comando,
repetido com um usuário existente, **redefine a senha** — é assim que se recupera
acesso perdido.

Para cadastrar mais pessoas da equipe, repita trocando usuário, senha e nome.

---

## 5. Subir como serviço

### Variáveis de ambiente

São apenas quatro, e o serviço systemd já traz todas com os valores corretos de
produção — **para um deploy padrão você não precisa configurar nada aqui**.

| Variável | Padrão no serviço | Para que serve |
| --- | --- | --- |
| `NODE_ENV` | `production` | Liga o modo de produção: cookie de sessão com `Secure` (exige HTTPS) e CORS desativado, já que frontend e API ficam na mesma origem. |
| `PORT` | `4000` | Porta da aplicação. Se mudar, ajuste também o `proxy_pass` no nginx. |
| `HOST` | `127.0.0.1` | Interface de escuta. Em `127.0.0.1` só o nginx alcança a aplicação, e a porta não fica exposta pelo IP do servidor. |
| `SESSION_SECURE` | *(não definida)* | Força a flag `Secure` do cookie. Sem ela, o valor acompanha o `NODE_ENV`, que é o comportamento desejado. |
| `ADMIN_USERNAME` | *(não definida)* | Cria o primeiro acesso na inicialização, para hospedagens **sem terminal**. Ver abaixo. |
| `ADMIN_PASSWORD` | *(não definida)* | Senha desse primeiro acesso (mínimo 8 caracteres). |
| `ADMIN_NAME` | *(não definida)* | Nome exibido do primeiro acesso. Opcional. |

### Primeiro acesso sem terminal

Em hospedagens que só oferecem painel (sem SSH), não há como rodar
`npm run create-user`. Nesse caso defina `ADMIN_USERNAME` e `ADMIN_PASSWORD`
nas variáveis da aplicação e reinicie: o usuário é criado na inicialização.

O seeding só age quando **não existe nenhum usuário**. Reiniciar não duplica o
acesso, e trocar as variáveis por outro nome depois não cria um segundo usuário
— ou seja, deixá-las configuradas não abre uma porta alternativa. Ainda assim,
o recomendado é **remover `ADMIN_PASSWORD`** depois do primeiro login e trocar a
senha pela própria aplicação.

> A aplicação lê apenas variáveis de ambiente do processo — **não existe leitura
> de arquivo `.env`**. Criar um `.env` na pasta do projeto não surte efeito; a
> configuração vem do systemd.

Para sobrescrever algum valor sem editar a unit, use o arquivo opcional:

```bash
cp /opt/workflow-ntt/deploy/workflow-ntt.env.example /etc/workflow-ntt.env
nano /etc/workflow-ntt.env

# O arquivo guarda configuração do serviço: restrinja a leitura
chown root:workflow /etc/workflow-ntt.env
chmod 640 /etc/workflow-ntt.env
```

O serviço lê esse caminho com `EnvironmentFile=-`, então ele é opcional (o `-`
faz o systemd seguir em frente se o arquivo não existir) e, por vir depois dos
padrões na unit, o que estiver nele prevalece.

O formato é `CHAVE=valor`, uma por linha — **sem `export`, sem aspas e sem
`${expansão}`**, que o systemd não interpreta.

Depois de qualquer alteração no arquivo:

```bash
systemctl restart workflow-ntt
systemctl show workflow-ntt -p Environment   # confere o que foi aplicado
```

### Instalar o serviço

```bash
cp /opt/workflow-ntt/deploy/workflow-ntt.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now workflow-ntt

systemctl status workflow-ntt --no-pager
```

Deve aparecer `active (running)`. A aplicação escuta apenas em `127.0.0.1:4000` —
não fica exposta direto na internet.

Ver logs:

```bash
journalctl -u workflow-ntt -f
```

---

## 6. nginx + HTTPS

O arquivo já vem preenchido com `iadasilva.com.br`, não é preciso editar nada.

```bash
cp /opt/workflow-ntt/deploy/nginx.conf /etc/nginx/sites-available/workflow-ntt
ln -sf /etc/nginx/sites-available/workflow-ntt /etc/nginx/sites-enabled/

# Remove o site padrão, que senão responde no lugar do nosso
rm -f /etc/nginx/sites-enabled/default
```

Os blocos HTTPS apontam para certificados que ainda não existem, então o
`nginx -t` falharia agora. A sequência é: subir só o HTTP, emitir o certificado
e então ligar o HTTPS.

```bash
# 1. Comenta tudo a partir do primeiro bloco 443
sed -i '/^# HTTPS no www/,$ s/^/#/' /etc/nginx/sites-available/workflow-ntt

mkdir -p /var/www/html
nginx -t && systemctl reload nginx
```

Confirme que o HTTP está de pé antes de continuar — deve responder `301`:

```bash
curl -sI http://iadasilva.com.br | head -1
```

```bash
# 2. Emite o certificado SEM deixar o certbot editar o nginx
apt install -y certbot
certbot certonly --webroot -w /var/www/html \
  -d iadasilva.com.br -d www.iadasilva.com.br \
  --deploy-hook "systemctl reload nginx"

# 3. Liga o HTTPS
sed -i '/^## HTTPS no www/,$ s/^#//' /etc/nginx/sites-available/workflow-ntt
nginx -t && systemctl reload nginx
```

> Uso `certonly --webroot` de propósito, em vez de `certbot --nginx`: o modo
> `--nginx` reescreve a configuração e criaria um bloco 443 próprio, que
> conflitaria com os nossos ao serem reativados. O `--deploy-hook` recarrega o
> nginx a cada renovação automática.

> Se o certbot falhar com `Timeout` ou `unauthorized`, o domínio ainda não está
> apontando para este servidor — volte ao passo 1.

---

## 7. Firewall

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
ufw status
```

A porta 4000 **não** deve aparecer na lista — o acesso a ela é só interno.

---

## 8. Conferir

Abra `https://iadasilva.com.br`. Deve aparecer a tela de login, com cadeado de HTTPS.
Entre com o usuário criado no passo 4.

Verificações de segurança que valem fazer uma vez:

```bash
# A aplicação NÃO deve responder direto pelo IP na porta 4000
curl -m 5 http://SEU_IP:4000/api/health    # esperado: falhar/timeout

# Sem sessão, a API deve recusar
curl -s -o /dev/null -w '%{http_code}\n' https://iadasilva.com.br/api/cases   # esperado: 401
```

---

## 9. Backup

Os dados ficam em dois lugares: `server/data/workflow.db` (banco) e
`server/uploads/` (currículos e anexos de email). Há um script pronto:

```bash
chmod +x /opt/workflow-ntt/deploy/backup.sh
/opt/workflow-ntt/deploy/backup.sh          # testa uma execução

crontab -e
# adicione a linha:
0 2 * * * /opt/workflow-ntt/deploy/backup.sh >> /var/log/workflow-backup.log 2>&1
```

Os backups vão para `/var/backups/workflow-ntt`, com retenção de 30 dias. Como
guardam dados pessoais de candidatos, mantenha-os fora do alcance público e
considere copiá-los para outro local.

---

## Atualizar a aplicação

```bash
cd /opt/workflow-ntt
git pull
npm run install:all
npm run build
chown -R workflow:workflow /opt/workflow-ntt
systemctl restart workflow-ntt
```

O banco é preservado — as tabelas são criadas com `IF NOT EXISTS`.

---

## Diagnóstico de `403 Forbidden`

**A aplicação nunca responde 403** — ela usa `401` para acesso negado. Um 403 no
navegador vem sempre da camada web (nginx ou outro vhost), antes de chegar ao
Node. Rode na ordem:

```bash
# 1. O Node está no ar?
systemctl status workflow-ntt --no-pager | head -5
curl -s -o /dev/null -w 'node local: %{http_code}\n' http://127.0.0.1:4000/api/health
#    200 aqui = aplicação saudável, o problema é de roteamento

# 2. Quem está atendendo as portas 80/443?
systemctl is-active nginx apache2 lshttpd 2>/dev/null
ss -tlnp | grep -E ':80 |:443 '

# 3. O motivo exato costuma estar aqui
tail -20 /var/log/nginx/error.log

# 4. Qual vhost está ativo
ls -l /etc/nginx/sites-enabled/
nginx -T 2>/dev/null | grep -nE 'server_name|root |proxy_pass' | head -30

# 5. O domínio aponta para ESTE servidor?
curl -s ifconfig.me; echo '  <- IP real deste servidor'
dig +short iadasilva.com.br A
```

Interpretação:

| Achado | Causa | Correção |
| --- | --- | --- |
| Passo 5: IPs diferentes | Domínio aponta para a hospedagem compartilhada, não para o VPS | Passo 1 deste guia |
| Passo 3: `directory index of ... is forbidden` | Outro vhost servindo pasta vazia | Remova/desative esse vhost e deixe só o `workflow-ntt` |
| Passo 4: `default` em sites-enabled | Site padrão respondendo antes do nosso | `rm -f /etc/nginx/sites-enabled/default && systemctl reload nginx` |
| Passo 2: `apache2`/`lshttpd` ativo | Outro servidor web ocupou as portas | Desative-o (`systemctl disable --now apache2`) ou migre a configuração para ele |
| Passo 1: falha de conexão | Aplicação caída | `journalctl -u workflow-ntt -n 50` |

---

## Problemas comuns

| Sintoma | Causa provável | O que fazer |
| --- | --- | --- |
| `403 Forbidden` | Não vem da aplicação — outro vhost ou DNS errado | Ver a seção de diagnóstico acima |
| `502 Bad Gateway` | Aplicação caiu | `systemctl status workflow-ntt` e `journalctl -u workflow-ntt -n 50` |
| Login não permanece | Cookie `Secure` sem HTTPS | Conclua o passo 6; o site precisa abrir em `https://`. Só para teste sem certificado, use `SESSION_SECURE=false` |
| Mudou variável e nada aconteceu | Serviço não reiniciado, ou `.env` no lugar errado | `systemctl restart workflow-ntt`; a configuração é lida de `/etc/workflow-ntt.env`, não de um `.env` no projeto |
| `413 Request Entity Too Large` | Arquivo maior que o limite do nginx | Aumente `client_max_body_size` no nginx |
| Erro de SQLite ao iniciar | Node abaixo da versão 22 | `node --version` e reinstale pelo passo 2 |
| `vite: not found` no build | Dependências do client ausentes | Rode `npm install` na **raiz** do projeto: o `postinstall` instala server e client. O `npm run build` também instala sozinho. |
| `Cannot find module 'express'` | Dependências do server ausentes | Mesma solução: `npm install` na raiz |
| `permission denied` em uploads | Dono errado das pastas | `chown -R workflow:workflow /opt/workflow-ntt` |
| Esqueceu a senha | — | Rode o comando do passo 4 novamente com o mesmo usuário |

---

## Nota sobre dados pessoais

A aplicação armazena currículos, nomes, emails, telefones e LinkedIn de
candidatos. Com o login ativo e o HTTPS configurado, o acesso fica restrito a
quem tem credencial e o tráfego vai criptografado. Ainda assim, vale:

- dar acesso apenas a quem precisa, com senha individual por pessoa;
- manter os backups em local restrito;
- remover casos e anexos quando não houver mais motivo para guardá-los.
