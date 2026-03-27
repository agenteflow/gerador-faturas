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

  // Logo: URL, base64, ou só texto
  let logoHtml = '';
  if (empresa.logo) {
    const src = empresa.logo.startsWith('data:') ? empresa.logo : empresa.logo;
    logoHtml = `<img src="${src}" style="max-height: 70px; max-width: 150px; object-fit: contain;" />`;
  }

  // Gera os trechos (voos)
  const trechosHtml = trechos.map(t => `
    <tr>
      <td colspan="8" style="padding: 2px 5px; border: 1px solid #ccc; font-size: 10px;">
        <div>Cia: &nbsp; Voo: &nbsp; Classe: &nbsp; Origem / Destino:</div>
      </td>
      <td colspan="2" style="padding: 2px 5px; border: 1px solid #ccc; font-size: 10px; text-align: right;">
        <div>Sa&iacute;da / Chegada:</div>
      </td>
    </tr>
    <tr>
      <td colspan="8" style="padding: 2px 5px 2px 15px; border: 1px solid #ccc; border-top: none; font-size: 10px;">
        <div>${t.cia || ''} &nbsp; ${t.voo || ''} &nbsp; ${t.classe || ''} &nbsp; ${t.origem || ''}</div>
      </td>
      <td colspan="2" style="padding: 2px 5px; border: 1px solid #ccc; border-top: none; font-size: 10px; text-align: right;">
        ${t.saida || ''}
      </td>
    </tr>
    <tr>
      <td colspan="8" style="padding: 2px 5px 5px 53px; border: 1px solid #ccc; border-top: none; font-size: 10px;">
        ${t.destino || ''}
      </td>
      <td colspan="2" style="padding: 2px 5px 5px 5px; border: 1px solid #ccc; border-top: none; font-size: 10px; text-align: right;">
        ${t.chegada || ''}
      </td>
    </tr>
  `).join('');

  // Gera os passageiros
  const passageirosHtml = passageiros.map(p => `
    <tr>
      <td style="padding: 3px 5px; border: 1px solid #ccc; font-size: 10px;">${p.nome || ''}</td>
      <td style="padding: 3px 5px; border: 1px solid #ccc; font-size: 10px;">${p.bilhete || ''}</td>
      <td style="padding: 3px 5px; border: 1px solid #ccc; font-size: 10px;">${p.custoPax || ''}</td>
      <td style="padding: 3px 5px; border: 1px solid #ccc; font-size: 10px; text-align: right;">R$ ${formatarValor(p.valor)}</td>
      <td style="padding: 3px 5px; border: 1px solid #ccc; font-size: 10px; text-align: right;">R$ ${formatarValor(p.taxas)}</td>
      <td style="padding: 3px 5px; border: 1px solid #ccc; font-size: 10px; text-align: right;">R$ ${formatarValor(p.descTaxas)}</td>
      <td style="padding: 3px 5px; border: 1px solid #ccc; font-size: 10px; text-align: right;">R$ ${formatarValor(p.total)}</td>
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
      font-size: 11px;
      color: #000;
      padding: 30px 40px;
      line-height: 1.4;
    }
    table { border-collapse: collapse; }
  </style>
</head>
<body>

  <!-- ========== HEADER ========== -->
  <table style="width: 100%; margin-bottom: 15px;">
    <tr>
      <td style="width: 160px; vertical-align: top;">
        ${logoHtml}
      </td>
      <td style="vertical-align: top; padding-left: 15px;">
        <div style="font-size: 22px; font-weight: bold; margin-bottom: 4px;">${empresa.nome || 'Nome da Empresa'}</div>
        <div style="font-size: 9px; line-height: 1.5; color: #333;">
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
  <table style="width: 100%; margin-bottom: 0; border-top: 2px solid #000; border-bottom: 1px solid #ccc;">
    <tr>
      <td style="padding: 6px 0; font-size: 11px; font-weight: bold;">
        Emiss&atilde;o: ${fatura.dataEmissao || ''}
      </td>
      <td style="padding: 6px 0; font-size: 11px; font-weight: bold; text-align: center;">
        Fatura: ${fatura.numero || ''}
      </td>
      <td style="padding: 6px 0; font-size: 11px; font-weight: bold; text-align: right;">
        Vencimento: ${fatura.vencimento || ''}
      </td>
    </tr>
  </table>

  <!-- ========== VALOR DESTAQUE ========== -->
  <table style="width: 100%; margin-bottom: 10px;">
    <tr>
      <td style="text-align: right; padding: 6px 0; font-size: 12px; font-weight: bold;">
        Valor: R$ ${formatarValor(totais.valorFaturado || totais.total)}
      </td>
    </tr>
  </table>

  <!-- ========== SACADO (CLIENTE) ========== -->
  <table style="width: 100%; border: 1px solid #ccc; margin-bottom: 10px;">
    <tr>
      <td style="padding: 3px 5px; border: 1px solid #ccc; font-size: 10px; width: 70px; vertical-align: top;">Sacado:</td>
      <td style="padding: 3px 5px; border: 1px solid #ccc; font-size: 10px; font-weight: bold;" colspan="3">${cliente.nome || ''}</td>
      <td style="padding: 3px 5px; border: 1px solid #ccc; font-size: 10px;" rowspan="3" colspan="2">
        Cidade: ${cliente.cidade || ''}<br>
        IE/RG: ${cliente.ieRg || ''}<br>
        E-mail: ${cliente.email || ''}
      </td>
      <td style="padding: 3px 5px; border: 1px solid #ccc; font-size: 10px;" rowspan="3">
        UF:<br>${cliente.uf || ''}
      </td>
      <td style="padding: 3px 5px; border: 1px solid #ccc; font-size: 10px;" rowspan="3">
        CEP: ${cliente.cep || ''}
      </td>
    </tr>
    <tr>
      <td style="padding: 3px 5px; border: 1px solid #ccc; font-size: 10px;">Endere&ccedil;o:</td>
      <td style="padding: 3px 5px; border: 1px solid #ccc; font-size: 10px;" colspan="3">${cliente.endereco || ''}</td>
    </tr>
    <tr>
      <td style="padding: 3px 5px; border: 1px solid #ccc; font-size: 10px;">Bairro:</td>
      <td style="padding: 3px 5px; border: 1px solid #ccc; font-size: 10px;" colspan="3">${cliente.bairro || ''}</td>
    </tr>
    <tr>
      <td style="padding: 3px 5px; border: 1px solid #ccc; font-size: 10px;">CPF/CNPJ:</td>
      <td style="padding: 3px 5px; border: 1px solid #ccc; font-size: 10px;" colspan="3">${cliente.documento || ''}</td>
      <td style="padding: 3px 5px; border: 1px solid #ccc; font-size: 10px;" colspan="4"></td>
    </tr>
    <tr>
      <td style="padding: 3px 5px; border: 1px solid #ccc; font-size: 10px;">Telefone:</td>
      <td style="padding: 3px 5px; border: 1px solid #ccc; font-size: 10px;" colspan="3">${cliente.telefone || ''}</td>
      <td style="padding: 3px 5px; border: 1px solid #ccc; font-size: 10px;" colspan="4">E-mail: ${cliente.email || ''}</td>
    </tr>
  </table>

  <!-- ========== VENDA ========== -->
  <table style="width: 100%; border: 1px solid #ccc; margin-bottom: 0;">
    <tr>
      <td style="padding: 3px 5px; border: 1px solid #ccc; font-size: 10px; width: 80px;">
        <span style="font-size: 9px; color: #666;">Venda:</span><br>${venda.numero || ''}
      </td>
      <td style="padding: 3px 5px; border: 1px solid #ccc; font-size: 10px; width: 90px;">
        <span style="font-size: 9px; color: #666;">Data:</span><br>${venda.data || ''}
      </td>
      <td style="padding: 3px 5px; border: 1px solid #ccc; font-size: 10px;">
        <span style="font-size: 9px; color: #666;">Produto:</span><br>${venda.produto || 'Passagem A\u00e9rea'}
      </td>
      <td style="padding: 3px 5px; border: 1px solid #ccc; font-size: 10px;">
        <span style="font-size: 9px; color: #666;">Solicitante:</span><br>${venda.solicitante || ''}
      </td>
    </tr>
    <tr>
      <td style="padding: 3px 5px; border: 1px solid #ccc; font-size: 10px;" colspan="2">
        <span style="font-size: 9px; color: #666;">N&ordm; Externo:</span><br>${venda.numeroExterno || ''}
      </td>
      <td style="padding: 3px 5px; border: 1px solid #ccc; font-size: 10px;" colspan="2">
        <span style="font-size: 9px; color: #666;">Centro de Custo:</span><br>${venda.centroCusto || ''}
      </td>
    </tr>
  </table>

  <!-- ========== CIA AÉREA / LOCALIZADOR ========== -->
  <table style="width: 100%; border: 1px solid #ccc; margin-bottom: 0; border-top: none;">
    <tr>
      <td style="padding: 3px 5px; border: 1px solid #ccc; border-top: none; font-size: 10px; width: 50%;">
        <span style="font-size: 9px; color: #666;">Cia A&eacute;rea:</span><br>${voo.ciaAerea || ''}
      </td>
      <td style="padding: 3px 5px; border: 1px solid #ccc; border-top: none; font-size: 10px; width: 50%;">
        <span style="font-size: 9px; color: #666;">Localizador:</span><br>${voo.localizador || ''}
      </td>
    </tr>
  </table>

  <!-- ========== TRECHOS (VOOS) ========== -->
  <table style="width: 100%; border: 1px solid #ccc; margin-bottom: 0; border-top: none;">
    ${trechosHtml}
  </table>

  <!-- ========== PASSAGEIROS ========== -->
  <table style="width: 100%; border: 1px solid #ccc; margin-bottom: 0; border-top: none;">
    <tr>
      <td style="padding: 3px 5px; border: 1px solid #ccc; font-size: 9px; color: #666;">Passageiro:</td>
      <td style="padding: 3px 5px; border: 1px solid #ccc; font-size: 9px; color: #666;">N&ordm; Bilhete:</td>
      <td style="padding: 3px 5px; border: 1px solid #ccc; font-size: 9px; color: #666;">C. Custo Passageiro:</td>
      <td style="padding: 3px 5px; border: 1px solid #ccc; font-size: 9px; color: #666; text-align: right;">Valor:</td>
      <td style="padding: 3px 5px; border: 1px solid #ccc; font-size: 9px; color: #666; text-align: right;">Taxas:</td>
      <td style="padding: 3px 5px; border: 1px solid #ccc; font-size: 9px; color: #666; text-align: right;">Desc Taxas:</td>
      <td style="padding: 3px 5px; border: 1px solid #ccc; font-size: 9px; color: #666; text-align: right;">Total:</td>
    </tr>
    ${passageirosHtml}
  </table>

  <!-- ========== RESUMO FINANCEIRO ========== -->
  <table style="width: 100%; border: 1px solid #ccc; margin-bottom: 0; border-top: none;">
    <tr>
      <td style="padding: 3px 5px; border: 1px solid #ccc; font-size: 10px; text-align: right;">
        <span style="font-size: 9px; color: #666;">Valor:</span><br>R$ ${formatarValor(totais.valor)}
      </td>
      <td style="padding: 3px 5px; border: 1px solid #ccc; font-size: 10px; text-align: right;">
        <span style="font-size: 9px; color: #666;">Abatimentos:</span><br>R$ ${formatarValor(totais.abatimentos)}
      </td>
      <td style="padding: 3px 5px; border: 1px solid #ccc; font-size: 10px; text-align: right;">
        <span style="font-size: 9px; color: #666;">Taxas:</span><br>R$ ${formatarValor(totais.taxas)}
      </td>
      <td style="padding: 3px 5px; border: 1px solid #ccc; font-size: 10px; text-align: right;">
        <span style="font-size: 9px; color: #666;">Total:</span><br>R$ ${formatarValor(totais.total)}
      </td>
      <td style="padding: 3px 5px; border: 1px solid #ccc; font-size: 10px; text-align: right; font-weight: bold;">
        <span style="font-size: 9px; color: #666;">Valor Faturado:</span><br>R$ ${formatarValor(totais.valorFaturado || totais.total)}
      </td>
    </tr>
  </table>

  <!-- ========== TOTAL DA FATURA ========== -->
  <table style="width: 100%; margin-bottom: 15px; border: 1px solid #ccc; border-top: none;">
    <tr>
      <td style="padding: 5px; font-size: 11px; font-weight: bold; text-align: right;">
        Total da Fatura: &nbsp;&nbsp; R$ ${formatarValor(totais.valorFaturado || totais.total)}
      </td>
    </tr>
  </table>

  <!-- ========== DADOS BANCÁRIOS ========== -->
  <table style="width: 100%; border: 1px solid #ccc; margin-bottom: 40px;">
    <tr>
      <td style="padding: 8px 10px; font-size: 10px; line-height: 1.6;">
        ${pagamento.banco || ''}<br>
        Titular: ${pagamento.titular || ''}<br>
        CNPJ: ${pagamento.cnpj || ''}<br>
        CHAVE PIX E-MAIL: ${pagamento.chavePix || ''}<br>
        Duvidas entre em contato atraves do e-mail: ${pagamento.emailDuvidas || ''}
      </td>
    </tr>
  </table>

  <!-- ========== ESPAÇO + RODAPÉ ========== -->
  <div style="min-height: 100px;"></div>

  <!-- ========== ACEITE ========== -->
  <table style="width: 100%; border-top: 1px solid #ccc; position: fixed; bottom: 60px; left: 40px; right: 40px; width: calc(100% - 80px);">
    <tr>
      <td style="padding-top: 10px; font-size: 10px; text-align: center;">
        ACEITE: ______________________________________________ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; DATA: ______________________
      </td>
    </tr>
  </table>

  <!-- ========== DATA GERAÇÃO + PÁGINA ========== -->
  <table style="width: 100%; position: fixed; bottom: 30px; left: 40px; right: 40px; width: calc(100% - 80px);">
    <tr>
      <td style="font-size: 9px; color: #666;">${fatura.dataGeracaoExtenso || ''}</td>
      <td style="font-size: 9px; color: #666; text-align: right;">P&aacute;gina 1 de 1</td>
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
