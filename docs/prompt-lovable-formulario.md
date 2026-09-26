Liga o formulário de marcação desta landing page ao nosso CRM. Hoje o botão "Confirmar o meu pedido de agendamento" só mostra uma mensagem e o pedido perde-se. Não alteres o design, os textos nem mais nada da página (em particular NÃO mexas no link/botão do WhatsApp).

1. Captura de UTM: quando a página carrega, lê da URL os parâmetros utm_source, utm_medium, utm_campaign, utm_content e utm_term. Se existir algum, guarda-os em sessionStorage (chave "crm_utm") para não se perderem se o visitante navegar. Guarda também, só na primeira visita da sessão, a URL completa de entrada (landing_page) e document.referrer (referrer). Envolve os acessos a sessionStorage em try/catch.

2. Campo anti-spam: acrescenta ao formulário um campo de texto escondido com name="empresa", fora do ecrã (position absolute, left -9999px), com tabIndex={-1}, autoComplete="off" e aria-hidden="true". As pessoas nunca o veem nem o preenchem.

3. Envio: ao submeter (mantém as validações que já existem, incluindo a caixa de consentimento obrigatória), faz:

fetch("URL_DO_CRM", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    nome, email, telefone, mensagem,
    consentimento: true,
    empresa: <valor do campo escondido>,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    landing_page, referrer
  })
})

(os utm_*, landing_page e referrer vêm do sessionStorage do passo 1; se não existirem, envia null)

4. Resposta:
- Enquanto envia: desativa o botão e mostra "A enviar…".
- Se a resposta for ok (status 2xx): mostra a mensagem de sucesso que já existe hoje e limpa o formulário.
- Se não for ok: lê o JSON da resposta e mostra num toast de erro o texto do campo "erro" (se não houver, "Não foi possível enviar o pedido. Tente novamente ou contacte-nos pelo WhatsApp."). Não limpes o formulário.
- Erro de rede: mesma mensagem de erro genérica.

5. Remove as chamadas a gtag(...) e fbq(...) que existem no envio do formulário, porque esses scripts não estão instalados (ou protege-as com typeof window.gtag === "function" / typeof window.fbq === "function").
