require('dotenv').config();
const {
  Client, GatewayIntentBits, Partials, Events,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  EmbedBuilder, ChannelType, PermissionsBitField
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

client.once(Events.ClientReady, async () => {
  console.log(`✅ Bot iniciado como ${client.user.tag}`);
  verificarPromocoes(); // promoção automática de recrutas
  enviarPaineisPorCanal(client); // painéis separados por canal
  atualizarHierarquia(client); // hierarquia automática com marcações
});

client.login(process.env.TOKEN);

// IDs personalizados dos canais 🔧 SUBSTITUA PELOS SEUS
const IDS = {
  painel: {
    registro: '1398016672664912043',
    ausencia: '1398016721192751186',
    bau: '1398290266250547220',
    denuncia: '1398289144433868910'
  },
  logs: {
    bauColocar: '1398016706164818072',
    bauRetirar: '1398016706164818072',
    registro: '1398016765426143343',
    ausencia: '1398298716078608659'
  },
  registroAprovacao: '1398290769953034382',
  hierarquia: '1398016716222497020',
  servidor: '1398013458439471348',
  cargoRegistro: '1398016636367147112',
  cargoAviaozinho: '1398016635419496538'
};

// Enviar painéis por canal (botões)
async function enviarPaineisPorCanal(client) {
  for (const tipo in IDS.painel) {
    const canal = client.channels.cache.get(IDS.painel[tipo]);
    if (!canal) continue;

    let row = new ActionRowBuilder();

    switch (tipo) {
      case 'registro':
        row.addComponents(
          new ButtonBuilder()
            .setCustomId('registrar')
            .setLabel('📋 Registrar-se')
            .setStyle(ButtonStyle.Success)
        );
        break;
      case 'ausencia':
        row.addComponents(
          new ButtonBuilder()
            .setCustomId('ticket_ausencia')
            .setLabel('📆 Ausência')
            .setStyle(ButtonStyle.Primary)
        );
        break;
      case 'bau':
        row.addComponents(
          new ButtonBuilder()
            .setCustomId('bau_colocar')
            .setLabel('📦 Colocar no Baú')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('bau_retirar')
            .setLabel('📤 Retirar do Baú')
            .setStyle(ButtonStyle.Secondary)
        );
        break;
      case 'denuncia':
        row.addComponents(
          new ButtonBuilder()
            .setCustomId('ticket_denuncia')
            .setLabel('🎫 Denúncia')
            .setStyle(ButtonStyle.Danger)
        );
        break;
    }

    await canal.send({
      content: `**📌 Painel de ${tipo.charAt(0).toUpperCase() + tipo.slice(1)}**`,
      components: [row]
    });
  }
}

// Interações (botões e modais)
client.on(Events.InteractionCreate, async interaction => {
  if (interaction.isButton()) {
    switch (interaction.customId) {
      case 'registrar':
        return abrirModalRegistro(interaction);
      case 'ticket_ausencia':
        return abrirModalAusencia(interaction);
      case 'bau_colocar':
        return abrirModalBau(interaction, 'colocou');
      case 'bau_retirar':
        return abrirModalBau(interaction, 'retirou');
      case 'ticket_denuncia':
        return criarTicketDenuncia(interaction);
      case 'assumir_denuncia':
        return assumirDenuncia(interaction);
      case 'fechar_denuncia':
        return fecharTicket(interaction);
      case 'aprovar_registro':
        return aprovarRegistro(interaction);
    }
  } else if (interaction.isModalSubmit()) {
    switch (interaction.customId) {
      case 'registroModal':
        return processarRegistro(interaction);
      case 'ausenciaModal':
        return processarAusencia(interaction);
      case 'bauModal_colocou':
      case 'bauModal_retirou':
        return processarBau(interaction);
    }
  }
});

// Modal registro
function abrirModalRegistro(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('registroModal')
    .setTitle('📋 Registro de Membro')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('nome_rp')
          .setLabel('Nome RP')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('id_rp')
          .setLabel('ID da Cidade')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('recrutador')
          .setLabel('Nome do Recrutador')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );
  return interaction.showModal(modal);
}

async function processarRegistro(interaction) {
  const nome = interaction.fields.getTextInputValue('nome_rp');
  const id = interaction.fields.getTextInputValue('id_rp');
  const recrutador = interaction.fields.getTextInputValue('recrutador');

  const embed = new EmbedBuilder()
    .setTitle('📋 Ficha de Registro')
    .addFields(
      { name: '👤 Nome RP', value: nome },
      { name: '🆔 ID da Cidade', value: id },
      { name: '🤝 Recrutador', value: recrutador },
      { name: '🆔 UserID', value: interaction.user.id }
    )
    .setColor('Green')
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('aprovar_registro')
      .setLabel('✅ Aprovar Registro')
      .setStyle(ButtonStyle.Success)
  );

  const canalFicha = interaction.guild.channels.cache.get(IDS.registroAprovacao);
  const canalLog = interaction.guild.channels.cache.get(IDS.logs.registro);

  if (canalFicha) await canalFicha.send({ embeds: [embed], components: [row] });
  if (canalLog) await canalLog.send({ embeds: [embed] });

  await interaction.reply({ content: '✅ Registro enviado para aprovação.', ephemeral: true });
}

// FUNÇÃO MODIFICADA: aprovarRegistro
async function aprovarRegistro(interaction) {
  const userId = interaction.message.embeds[0]?.fields.find(f => f.name === '🆔 UserID')?.value;
  if (!userId) {
    return interaction.reply({ content: '❌ ID do usuário não encontrado no registro.', ephemeral: true });
  }

  const guild = interaction.guild;
  const membro = await guild.members.fetch(userId).catch(() => null);
  if (!membro) {
    return interaction.reply({ content: '❌ Membro não encontrado para dar cargos.', ephemeral: true });
  }

  const cargoRegistro = guild.roles.cache.get(IDS.cargoRegistro);
  const cargoAviaozinho = guild.roles.cache.get(IDS.cargoAviaozinho);
  const cargoMembro = guild.roles.cache.find(r => r.name.toLowerCase() === 'membro');

  if (cargoRegistro && membro.roles.cache.has(cargoRegistro.id)) {
    await membro.roles.remove(cargoRegistro);
  }
  if (cargoAviaozinho) {
    await membro.roles.add(cargoAviaozinho);
  }
  if (cargoMembro) {
    await membro.roles.add(cargoMembro);
  }

  await interaction.update({
    content: '✅ Registro aprovado e cargos atualizados!',
    components: [],
    embeds: interaction.message.embeds
  });
}

// Criar ticket denúncia
async function criarTicketDenuncia(interaction) {
  const canal = await interaction.guild.channels.create({
    name: `🎫・denuncia-${interaction.user.username}`,
    type: ChannelType.GuildText,
    permissionOverwrites: [
      { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel] }
    ]
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('assumir_denuncia')
      .setLabel('👮 Assumir Denúncia')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('fechar_denuncia')
      .setLabel('❌ Fechar Denúncia')
      .setStyle(ButtonStyle.Danger)
  );

  await canal.send({
    content: `🎫 Denúncia criada por ${interaction.user}`,
    components: [row]
  });

  await interaction.reply({ content: '✅ Denúncia enviada. Um responsável irá te responder em breve!', ephemeral: true });
}

async function assumirDenuncia(interaction) {
  await interaction.reply({ content: `👮 ${interaction.user} assumiu esta denúncia.`, ephemeral: false });
}

async function fecharTicket(interaction) {
  const canal = interaction.channel;
  await canal.send('✅ Denúncia finalizada. Canal será fechado em 5 segundos...');
  setTimeout(() => canal.delete(), 5000);
}

// Modal ausência
function abrirModalAusencia(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('ausenciaModal')
    .setTitle('📆 Aviso de Ausência')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('motivo')
          .setLabel('Motivo da ausência')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('dias')
          .setLabel('Quantos dias estará ausente?')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );
  return interaction.showModal(modal);
}

async function processarAusencia(interaction) {
  const motivo = interaction.fields.getTextInputValue('motivo');
  const dias = interaction.fields.getTextInputValue('dias');

  const embed = new EmbedBuilder()
    .setTitle('📆 Aviso de Ausência')
    .addFields(
      { name: '👤 Membro', value: interaction.user.tag },
      { name: '📝 Motivo', value: motivo },
      { name: '⏳ Dias', value: dias }
    )
    .setColor('Blue')
    .setTimestamp();

  const canalLogAusencia = interaction.guild.channels.cache.get(IDS.logs.ausencia);
  if (canalLogAusencia) {
    await canalLogAusencia.send({ embeds: [embed] });
  }

  await interaction.reply({ content: '✅ Sua ausência foi registrada.', ephemeral: true });
}

// Modal bau
function abrirModalBau(interaction, acao) {
  const modal = new ModalBuilder()
    .setCustomId(`bauModal_${acao}`)
    .setTitle(`📦 ${acao === 'colocou' ? 'Colocar no Baú' : 'Retirar do Baú'}`)
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('item')
          .setLabel('Item')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('quantidade')
          .setLabel('Quantidade')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('motivo')
          .setLabel('Motivo')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      )
    );
  return interaction.showModal(modal);
}

async function processarBau(interaction) {
  const acao = interaction.customId.includes('colocou') ? 'colocou' : 'retirou';
  const item = interaction.fields.getTextInputValue('item');
  const quantidade = interaction.fields.getTextInputValue('quantidade');
  const motivo = interaction.fields.getTextInputValue('motivo');

  const embed = new EmbedBuilder()
    .setTitle(`📦 Log de Baú – ${acao}`)
    .addFields(
      { name: '👤 Membro', value: interaction.user.tag },
      { name: '📦 Item', value: item },
      { name: '🔢 Quantidade', value: quantidade },
      { name: '📝 Motivo', value: motivo }
    )
    .setColor(acao === 'colocou' ? 'Green' : 'Red')
    .setTimestamp();

  if (acao === 'colocou') {
    const canalColocar = interaction.guild.channels.cache.get(IDS.logs.bauColocar);
    if (canalColocar) await canalColocar.send({ embeds: [embed] });
  } else {
    const canalRetirar = interaction.guild.channels.cache.get(IDS.logs.bauRetirar);
    if (canalRetirar) await canalRetirar.send({ embeds: [embed] });
  }

  await interaction.reply({ content: '✅ Registro enviado com sucesso!', ephemeral: true });
}

// PROMOÇÃO AUTOMÁTICA DE RECRUTA
async function verificarPromocoes() {
  const guild = await client.guilds.fetch(IDS.servidor);
  const membros = await guild.members.fetch();
  const agora = Date.now();

  membros.forEach(membro => {
    const cargoRecruta = membro.roles.cache.find(r => r.name.toLowerCase() === 'recruta');
    const cargoMembro = membro.roles.cache.find(r => r.name.toLowerCase() === 'membro');

    if (cargoRecruta && !cargoMembro && membro.joinedTimestamp) {
      const dias = (agora - membro.joinedTimestamp) / (1000 * 60 * 60 * 24);
      if (dias >= 7) {
        const role = guild.roles.cache.find(r => r.name.toLowerCase() === 'membro');
        if (role) {
          membro.roles.add(role);
          const canal = guild.channels.cache.find(c => c.name.includes('promoções'));
          if (canal) canal.send(`🎉 ${membro} foi promovido automaticamente a Membro!`);
        }
      }
    }
  });
}

// HIERARQUIA AUTOMÁTICA COM MARCAÇÃO
async function atualizarHierarquia(client) {
  const canal = client.channels.cache.get(IDS.hierarquia);
  if (!canal) return;

  const guild = await client.guilds.fetch(IDS.servidor);
  const membros = await guild.members.fetch();

  const patentes = [
    { nome: '00 - Lider', titulo: '👑 Líder' },
    { nome: '01 - Sub Lider', titulo: '👑 Sub Líder 1' },
    { nome: '02 - Sub líder', titulo: '👑 Sub Líder 2' },
    { nome: 'gerente', titulo: '👨‍💼 Gerente' },
    { nome: 'gerente de ação', titulo: '🔫 Gerente de Ação' },
    { nome: 'gerente de vendas', titulo: '💸 Gerente de Vendas' },
    { nome: 'soldado', titulo: '⚔ Soldado' },
    { nome: 'membro', titulo: '🙋‍♂️ Membro' },
    { nome: 'aviãozinho', titulo: '✈️ Aguardando Aceite' }
  ];

  const mensagens = [];

  for (const p of patentes) {
    const cargo = guild.roles.cache.find(r => r.name.toLowerCase().includes(p.nome.toLowerCase()));
    if (cargo) {
      const membrosCargo = membros.filter(m => m.roles.cache.has(cargo.id));
      const lista = membrosCargo.map(m => `<@${m.id}>`).join(', ') || '*Ninguém*';
      mensagens.push(`${p.titulo}: ${lista}`);
    }
  }

  canal.send({
    content: `📊 **Hierarquia Atual:**\n\n${mensagens.join('\n')}`
  });
}
