const { Resend } = require('resend');

// So cria o client se a chave existir, pra nao quebrar em dev local sem
// RESEND_API_KEY configurada.
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const REMETENTE = 'Phisys <codigo@bioinovatecufes.com>';

// Envia o codigo de acesso por e-mail pro aluno recem-cadastrado (POST
// /usuarios e /usuarios/importar-confirmar, 28/08/2026 - pedido da Samela
// depois que bioinovatecufes.com foi verificado na Resend). Best effort de
// proposito: NUNCA lanca. O aluno ja foi gravado no banco antes desta
// chamada, e o professor sempre ve o codigo na tela como rede de seguranca -
// uma falha aqui (Resend fora do ar, e-mail invalido, etc.) so vira um log.
// Retorna true/false (21/10/2026): o SDK da Resend nao lanca em erro de API
// (devolve { error }) e o log dele e desligado em producao - antes disso uma
// recusa (429, endereco invalido...) passava em silencio. Bounce nao aparece
// aqui: e assincrono, a API aceita o envio e so depois o e-mail volta.
// comMotivo (item 3, 07/11/2026): mesmo envio, mas devolve tambem o nome do
// erro da Resend (ex: rate_limit_exceeded), pra importacao decidir se tenta
// de novo ou para. As outras rotas seguem usando so o true/false abaixo.
async function enviarCodigoEmailComMotivo(email, nome, codigo) {
  if (!resend) {
    console.error(`RESEND_API_KEY nao configurada - pulando envio de e-mail para ${email}.`);
    return { ok: false, erro: 'sem_chave' };
  }
  try {
    const { error } = await resend.emails.send({
      from: REMETENTE,
      to: email,
      subject: 'Seu código de acesso - Phisys',
      html: `
        <p>Olá, ${nome}!</p>
        <p>Você foi cadastrado(a) no Phisys. Acesse
        <a href="https://phisys.vercel.app">https://phisys.vercel.app</a> e use o código abaixo
        na tela de login, em "Primeiro acesso ou esqueceu a senha?", para definir sua senha:</p>
        <h2 style="letter-spacing:4px;">${codigo}</h2>
      `,
    });
    if (error) {
      console.error(`Resend recusou o e-mail de codigo de acesso para ${email}:`, error.statusCode, error.name, error.message);
      return { ok: false, erro: error.name };
    }
    return { ok: true };
  } catch (err) {
    console.error(`Erro ao enviar e-mail de codigo de acesso para ${email}:`, err.message);
    return { ok: false, erro: 'excecao' };
  }
}

async function enviarCodigoEmail(email, nome, codigo) {
  return (await enviarCodigoEmailComMotivo(email, nome, codigo)).ok;
}

module.exports = enviarCodigoEmail;
module.exports.comMotivo = enviarCodigoEmailComMotivo;
