# Deploy em VPS (Hostinger)

Guia para publicar a aplicação em um VPS Ubuntu/Debian, com HTTPS e domínio próprio.
Os comandos são para colar no terminal do VPS (console do hPanel ou SSH), na ordem.

Ao longo do guia, substitua:

- `SEU_DOMINIO` → o domínio real (ex.: `workflow.suaempresa.com.br`)
- `SEU_IP` → o IP do VPS

> **Requisito**: Node.js 22 ou superior (a aplicação usa o SQLite embutido do Node).
> Não funciona em hospedagem compartilhada — precisa ser VPS.

---

## 1. Apontar o domínio para o VPS

Antes de tudo, no painel do seu domínio, crie um registro:

| Tipo | Nome | Valor |
| --- | --- | --- |
| `A` | `@` (ou o subdomínio) | `SEU_IP` |

A propagação leva de alguns minutos a algumas horas. Confirme com:

```bash
dig +short SEU_DOMINIO
```

Só siga para o passo 6 (SSL) quando esse comando retornar o IP do VPS — o
certbot falha se o DNS ainda não estiver apontando.

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

npm run install:all
npm run build

chown -R workflow:workflow /opt/workflow-ntt
```

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

```bash
cp /opt/workflow-ntt/deploy/nginx.conf /etc/nginx/sites-available/workflow-ntt

# Troca o placeholder pelo domínio real
sed -i 's/SEU_DOMINIO/workflow.suaempresa.com.br/g' /etc/nginx/sites-available/workflow-ntt

ln -sf /etc/nginx/sites-available/workflow-ntt /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
```

O arquivo já vem com o bloco HTTPS pronto, mas os certificados ainda não existem,
então o nginx não vai validar. Emita o certificado primeiro:

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d SEU_DOMINIO
```

O certbot obtém o certificado, ajusta a configuração e programa a renovação
automática. Depois:

```bash
nginx -t && systemctl reload nginx
```

> Se o `nginx -t` reclamar de certificado inexistente antes de rodar o certbot,
> comente temporariamente o bloco `server { listen 443 ... }` inteiro, rode o
> certbot e descomente em seguida.

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

Abra `https://SEU_DOMINIO`. Deve aparecer a tela de login, com cadeado de HTTPS.
Entre com o usuário criado no passo 4.

Verificações de segurança que valem fazer uma vez:

```bash
# A aplicação NÃO deve responder direto pelo IP na porta 4000
curl -m 5 http://SEU_IP:4000/api/health    # esperado: falhar/timeout

# Sem sessão, a API deve recusar
curl -s -o /dev/null -w '%{http_code}\n' https://SEU_DOMINIO/api/cases   # esperado: 401
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

## Problemas comuns

| Sintoma | Causa provável | O que fazer |
| --- | --- | --- |
| `502 Bad Gateway` | Aplicação caiu | `systemctl status workflow-ntt` e `journalctl -u workflow-ntt -n 50` |
| Login não permanece | Cookie `Secure` sem HTTPS | Conclua o passo 6; o site precisa abrir em `https://`. Só para teste sem certificado, use `SESSION_SECURE=false` |
| Mudou variável e nada aconteceu | Serviço não reiniciado, ou `.env` no lugar errado | `systemctl restart workflow-ntt`; a configuração é lida de `/etc/workflow-ntt.env`, não de um `.env` no projeto |
| `413 Request Entity Too Large` | Arquivo maior que o limite do nginx | Aumente `client_max_body_size` no nginx |
| Erro de SQLite ao iniciar | Node abaixo da versão 22 | `node --version` e reinstale pelo passo 2 |
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
