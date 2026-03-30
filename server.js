// ============================================
// GERADOR DE FATURAS EM PDF - MILHASFLOW
// ============================================

const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
const PORTA = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ============================================
// HELPER - Formatar valor em Reais
// ============================================
function formatarValor(valor) {
  return (valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ============================================
// TEMPLATE HTML DA FATURA
// ============================================
function gerarHtmlFatura(dados) {
  const empresa = dados.empresa || {};
  const fatura = dados.fatura || {};
  const cliente = dados.cliente || {};
  const venda = dados.venda || {};
  const voo = dados.voo || {};
  const trechos = dados.trechos || [];
  const passageiros = dados.passageiros || [];
  const totais = dados.totais || {};
  const pagamento = dados.pagamento || {};

  // Logo: URL, base64, ou vazio
  let logoHtml = '<div style="width:80px; height:70px;"></div>';
  if (empresa.logo) {
    const src = empresa.logo.startsWith('data:') ? empresa.logo : empresa.logo;
    logoHtml = `<img src="${src}" style="max-height: 70px; max-width: 80px; object-fit: contain;" />`;
  }

  // Gera os trechos (voos)
  const trechosHtml = trechos.map(t => `
    <tr>
      <td colspan="7" style="padding: 2px 5px; border-left: 1px solid #999; border-right: none; font-size: 9px; color: #444;">
        Cia: &nbsp; Voo: &nbsp; Classe: &nbsp; Origem / Destino:
      </td>
      <td style="padding: 2px 5px; border-right: 1px solid #999; border-left: none; font-size: 9px; color: #444; text-align: right;">
        Sa&iacute;da / Chegada:
      </td>
    </tr>
    <tr>
      <td colspan="7" style="padding: 1px 5px 1px 10px; border-left: 1px solid #999; border-right: none; font-size: 9px;">
        ${t.cia || ''} &nbsp;&nbsp; ${t.voo || ''} &nbsp;&nbsp; ${t.classe || ''} &nbsp;&nbsp; ${t.origem || ''}
      </td>
      <td style="padding: 1px 5px; border-right: 1px solid #999; border-left: none; font-size: 9px; text-align: right;">
        ${t.saida || ''}
      </td>
    </tr>
    <tr>
      <td colspan="7" style="padding: 1px 5px 3px 53px; border-left: 1px solid #999; border-right: none; border-bottom: 1px solid #ddd; font-size: 9px;">
        ${t.destino || ''}
      </td>
      <td style="padding: 1px 5px 3px 5px; border-right: 1px solid #999; border-left: none; border-bottom: 1px solid #ddd; font-size: 9px; text-align: right;">
        ${t.chegada || ''}
      </td>
    </tr>
  `).join('');

  // Gera os passageiros
  const passageirosHtml = passageiros.map(p => `
    <tr>
      <td style="padding: 2px 5px; border: 1px solid #999; font-size: 9px;">${p.nome || ''}</td>
      <td style="padding: 2px 5px; border: 1px solid #999; font-size: 9px;">${p.bilhete || ''}</td>
      <td style="padding: 2px 5px; border: 1px solid #999; font-size: 9px;">${p.custoPax || ''}</td>
      <td style="padding: 2px 5px; border: 1px solid #999; font-size: 9px; text-align: right;">R$ ${formatarValor(p.valor)}</td>
      <td style="padding: 2px 5px; border: 1px solid #999; font-size: 9px; text-align: right;">R$ ${formatarValor(p.taxas)}</td>
      <td style="padding: 2px 5px; border: 1px solid #999; font-size: 9px; text-align: right;">R$ ${formatarValor(p.descTaxas)}</td>
      <td style="padding: 2px 5px; border: 1px solid #999; font-size: 9px; text-align: right;">R$ ${formatarValor(p.total)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 9px;
      color: #000;
      padding: 25px 35px;
      line-height: 1.3;
    }
    table { border-collapse: collapse; }
  </style>
</head>
<body>

  <!-- ========== HEADER ========== -->
  <table style="width: 100%; margin-bottom: 12px;">
    <tr>
      <td style="width: 90px; vertical-align: top;">
        ${logoHtml}
      </td>
      <td style="vertical-align: top; padding-left: 10px;">
        <div style="font-size: 18px; font-weight: bold; margin-bottom: 3px;">${empresa.nome || 'Nome da Empresa'}</div>
        <div style="font-size: 8px; line-height: 1.5; color: #333;">
          ${empresa.razaoSocial || empresa.nome || ''} - CNPJ: ${empresa.cnpj || ''}<br>
          ${empresa.endereco || ''}<br>
          ${empresa.cidade || ''} - ${empresa.uf || ''} - CEP: ${empresa.cep || ''}<br>
          Telefone: ${empresa.telefone || ''}<br>
          Website: ${empresa.website || ''} - E-mail: ${empresa.email || ''}
        </div>
      </td>
    </tr>
  </table>

  <!-- ========== EMISSÃO / FATURA / VENCIMENTO ========== -->
  <table style="width: 100%; margin-bottom: 0; border-top: 2px solid #000; border-bottom: 1px solid #999;">
    <tr>
      <td style="padding: 5px 0; font-size: 10px; font-weight: bold;">
        Emiss&atilde;o: ${fatura.dataEmissao || ''}
      </td>
      <td style="padding: 5px 0; font-size: 10px; font-weight: bold; text-align: center;">
        Fatura: ${fatura.numero || ''}
      </td>
      <td style="padding: 5px 0; font-size: 10px; font-weight: bold; text-align: right;">
        Vencimento: ${fatura.vencimento || ''}
      </td>
    </tr>
  </table>

  <!-- ========== VALOR DESTAQUE ========== -->
  <table style="width: 100%; margin-bottom: 8px;">
    <tr>
      <td style="text-align: right; padding: 4px 0; font-size: 10px; font-weight: bold;">
        Valor: R$ ${formatarValor(totais.valorFaturado || totais.total)}
      </td>
    </tr>
  </table>

  <!-- ========== SACADO (CLIENTE) ========== -->
  <table style="width: 100%; border: 1px solid #999; margin-bottom: 8px;">
    <tr>
      <td style="padding: 2px 5px; border: 1px solid #999; font-size: 8px; width: 55px; color: #444;">Sacado:</td>
      <td style="padding: 2px 5px; border: 1px solid #999; font-size: 9px; font-weight: bold;" colspan="2">${cliente.nome || ''}</td>
      <td style="padding: 2px 5px; border: 1px solid #999; font-size: 8px; color: #444; width: 55px;">Cidade:</td>
      <td style="padding: 2px 5px; border: 1px solid #999; font-size: 9px;">${cliente.cidade || ''}</td>
      <td style="padding: 2px 5px; border: 1px solid #999; font-size: 8px; color: #444; width: 25px;">UF:</td>
      <td style="padding: 2px 5px; border: 1px solid #999; font-size: 9px; width: 30px;">${cliente.uf || ''}</td>
      <td style="padding: 2px 5px; border: 1px solid #999; font-size: 8px; color: #444; width: 30px;">CEP:</td>
      <td style="padding: 2px 5px; border: 1px solid #999; font-size: 9px;">${cliente.cep || ''}</td>
    </tr>
    <tr>
      <td style="padding: 2px 5px; border: 1px solid #999; font-size: 8px; color: #444;">Endere&ccedil;o:</td>
      <td style="padding: 2px 5px; border: 1px solid #999; font-size: 9px;" colspan="2">${cliente.endereco || ''}</td>
      <td style="padding: 2px 5px; border: 1px solid #999; font-size: 8px; color: #444;">IE/RG:</td>
      <td style="padding: 2px 5px; border: 1px solid #999; font-size: 9px;" colspan="4">${cliente.ieRg || ''}</td>
    </tr>
    <tr>
      <td style="padding: 2px 5px; border: 1px solid #999; font-size: 8px; color: #444;">Bairro:</td>
      <td style="padding: 2px 5px; border: 1px solid #999; font-size: 9px;" colspan="2">${cliente.bairro || ''}</td>
      <td style="padding: 2px 5px; border: 1px solid #999; font-size: 8px; color: #444;" colspan="5">E-mail: ${cliente.email || ''}</td>
    </tr>
    <tr>
      <td style="padding: 2px 5px; border: 1px solid #999; font-size: 8px; color: #444;">CPF/CNPJ:</td>
      <td style="padding: 2px 5px; border: 1px solid #999; font-size: 9px;" colspan="2">${cliente.documento || ''}</td>
      <td style="padding: 2px 5px; border: 1px solid #999; font-size: 9px;" colspan="5"></td>
    </tr>
    <tr>
      <td style="padding: 2px 5px; border: 1px solid #999; font-size: 8px; color: #444;">Telefone:</td>
      <td style="padding: 2px 5px; border: 1px solid #999; font-size: 9px;" colspan="8">${cliente.telefone || ''}</td>
    </tr>
  </table>

  <!-- ========== VENDA ========== -->
  <table style="width: 100%; border: 1px solid #999; margin-bottom: 0;">
    <tr>
      <td style="padding: 2px 5px; border: 1px solid #999; font-size: 9px; width: 70px;">
        <span style="font-size: 8px; color: #444;">Venda:</span><br>${venda.numero || ''}
      </td>
      <td style="padding: 2px 5px; border: 1px solid #999; font-size: 9px; width: 80px;">
        <span style="font-size: 8px; color: #444;">Data:</span><br>${venda.data || ''}
      </td>
      <td style="padding: 2px 5px; border: 1px solid #999; font-size: 9px;">
        <span style="font-size: 8px; color: #444;">Produto:</span><br>${venda.produto || 'Passagem A\u00e9rea'}
      </td>
      <td style="padding: 2px 5px; border: 1px solid #999; font-size: 9px;">
        <span style="font-size: 8px; color: #444;">Solicitante:</span><br>${venda.solicitante || ''}
      </td>
    </tr>
    <tr>
      <td style="padding: 2px 5px; border: 1px solid #999; font-size: 9px;" colspan="2">
        <span style="font-size: 8px; color: #444;">N&ordm; Externo:</span><br>${venda.numeroExterno || ''}
      </td>
      <td style="padding: 2px 5px; border: 1px solid #999; font-size: 9px;" colspan="2">
        <span style="font-size: 8px; color: #444;">Centro de Custo:</span><br>${venda.centroCusto || ''}
      </td>
    </tr>
  </table>

  <!-- ========== CIA AÉREA / LOCALIZADOR ========== -->
  <table style="width: 100%; border: 1px solid #999; margin-bottom: 0; border-top: none;">
    <tr>
      <td style="padding: 2px 5px; border: 1px solid #999; border-top: none; font-size: 9px; width: 50%;">
        <span style="font-size: 8px; color: #444;">Cia A&eacute;rea:</span><br>${voo.ciaAerea || ''}
      </td>
      <td style="padding: 2px 5px; border: 1px solid #999; border-top: none; font-size: 9px; width: 50%;">
        <span style="font-size: 8px; color: #444;">Localizador:</span><br>${voo.localizador || ''}
      </td>
    </tr>
  </table>

  <!-- ========== TRECHOS (VOOS) ========== -->
  <table style="width: 100%; border-left: 1px solid #999; border-right: 1px solid #999; border-bottom: 1px solid #999; margin-bottom: 0;">
    ${trechosHtml}
  </table>

  <!-- ========== PASSAGEIROS ========== -->
  <table style="width: 100%; border: 1px solid #999; margin-bottom: 0; border-top: none;">
    <tr>
      <td style="padding: 2px 5px; border: 1px solid #999; font-size: 8px; color: #444;">Passageiro:</td>
      <td style="padding: 2px 5px; border: 1px solid #999; font-size: 8px; color: #444;">N&ordm; Bilhete:</td>
      <td style="padding: 2px 5px; border: 1px solid #999; font-size: 8px; color: #444;">C. Custo Passageiro:</td>
      <td style="padding: 2px 5px; border: 1px solid #999; font-size: 8px; color: #444; text-align: right;">Valor:</td>
      <td style="padding: 2px 5px; border: 1px solid #999; font-size: 8px; color: #444; text-align: right;">Taxas:</td>
      <td style="padding: 2px 5px; border: 1px solid #999; font-size: 8px; color: #444; text-align: right;">Desc Taxas:</td>
      <td style="padding: 2px 5px; border: 1px solid #999; font-size: 8px; color: #444; text-align: right;">Total:</td>
    </tr>
    ${passageirosHtml}
  </table>

  <!-- ========== RESUMO FINANCEIRO ========== -->
  <table style="width: 100%; border: 1px solid #999; margin-bottom: 0; border-top: none;">
    <tr>
      <td style="padding: 3px 5px; border: 1px solid #999; font-size: 9px; text-align: right;">
        <span style="font-size: 8px; color: #444;">Valor:</span><br>R$ ${formatarValor(totais.valor)}
      </td>
      <td style="padding: 3px 5px; border: 1px solid #999; font-size: 9px; text-align: right;">
        <span style="font-size: 8px; color: #444;">Abatimentos:</span><br>R$ ${formatarValor(totais.abatimentos)}
      </td>
      <td style="padding: 3px 5px; border: 1px solid #999; font-size: 9px; text-align: right;">
        <span style="font-size: 8px; color: #444;">Taxas:</span><br>R$ ${formatarValor(totais.taxas)}
      </td>
      <td style="padding: 3px 5px; border: 1px solid #999; font-size: 9px; text-align: right;">
        <span style="font-size: 8px; color: #444;">Total:</span><br>R$ ${formatarValor(totais.total)}
      </td>
      <td style="padding: 3px 5px; border: 1px solid #999; font-size: 9px; text-align: right; font-weight: bold;">
        <span style="font-size: 8px; color: #444;">Valor Faturado:</span><br>R$ ${formatarValor(totais.valorFaturado || totais.total)}
      </td>
    </tr>
  </table>

  <!-- ========== TOTAL DA FATURA ========== -->
  <table style="width: 100%; margin-bottom: 10px; border: 1px solid #999; border-top: none;">
    <tr>
      <td style="padding: 4px 5px; font-size: 10px; font-weight: bold; text-align: right;">
        Total da Fatura: &nbsp;&nbsp; R$ ${formatarValor(totais.valorFaturado || totais.total)}
      </td>
    </tr>
  </table>

  <!-- ========== DADOS BANCÁRIOS ========== -->
  <table style="width: 100%; border: 1px solid #999; margin-bottom: 0;">
    <tr>
      <td style="padding: 6px 8px; font-size: 8px; line-height: 1.6;">
        ${pagamento.banco || ''}<br>
        Titular: ${pagamento.titular || ''}<br>
        CNPJ: ${pagamento.cnpj || ''}<br>
        CHAVE PIX E-MAIL: ${pagamento.chavePix || ''}<br>
        Duvidas entre em contato atraves do e-mail: ${pagamento.emailDuvidas || ''}
      </td>
    </tr>
  </table>

  <!-- ========== ACEITE (fixo no rodapé) ========== -->
  <table style="width: 100%; border-top: 1px solid #999; position: fixed; bottom: 50px; left: 35px; right: 35px; width: calc(100% - 70px);">
    <tr>
      <td style="padding-top: 8px; font-size: 9px; text-align: center;">
        ACEITE: ______________________________________________ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; DATA: ______________________
      </td>
    </tr>
  </table>

  <!-- ========== DATA GERAÇÃO + PÁGINA ========== -->
  <table style="width: 100%; position: fixed; bottom: 25px; left: 35px; right: 35px; width: calc(100% - 70px);">
    <tr>
      <td style="font-size: 8px; color: #666;">${fatura.dataGeracaoExtenso || ''}</td>
      <td style="font-size: 8px; color: #666; text-align: right;">P&aacute;gina 1 de 1</td>
    </tr>
  </table>

</body>
</html>`;
}

// ============================================
// ROTA PRINCIPAL - GERAR PDF
// ============================================
app.post('/gerar-fatura', async (req, res) => {
  console.log('Recebendo pedido de fatura...');

  try {
    const dados = req.body;
    const html = gerarHtmlFatura(dados);

    console.log('Abrindo navegador...');

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    console.log('Gerando PDF...');

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10px', right: '10px', bottom: '10px', left: '10px' }
    });

    await browser.close();

    console.log('PDF gerado com sucesso!');

    res.contentType('application/pdf');
    res.send(pdf);

  } catch (erro) {
    console.error('Erro ao gerar PDF:', erro);
    res.status(500).json({
      erro: 'Falha ao gerar PDF',
      detalhes: erro.message
    });
  }
});

// ============================================
// ROTA DE TESTE
// ============================================
app.get('/', (req, res) => {
  res.send(`
    <html>
      <body style="font-family: Arial; padding: 50px; text-align: center;">
        <h1>API de Faturas MilhasFlow</h1>
        <p>Servidor funcionando!</p>
        <p style="color: green; font-weight: bold;">Status: ONLINE</p>
        <p style="margin-top: 20px; font-size: 14px; color: #666;">POST /gerar-fatura para gerar um PDF</p>
      </body>
    </html>
  `);
});

// ============================================
// INICIAR SERVIDOR
// ============================================
app.listen(PORTA, () => {
  console.log('');
  console.log('=================================');
  console.log('SERVIDOR INICIADO COM SUCESSO!');
  console.log('=================================');
  console.log(`URL: http://localhost:${PORTA}`);
  console.log('POST /gerar-fatura para gerar PDF');
  console.log('=================================');
  console.log('');
});
