import { workflow, node, trigger, ifElse, switchCase } from '@n8n/workflow-sdk';

const entrada = trigger({"type":"n8n-nodes-base.executeWorkflowTrigger","version":1.2,"config":{"name":"Entrada","parameters":{"inputSource":"workflowInputs","workflowInputs":{"values":[{"name":"lead_id","type":"string"},{"name":"acao","type":"string"},{"name":"cpf","type":"string"},{"name":"numero","type":"string"},{"name":"chave","type":"string"},{"name":"tipo","type":"string"},{"name":"motivo","type":"string"},{"name":"prazo","type":"string"},{"name":"parcela","type":"string"}]}}}});

const rota = switchCase({"version":3.2,"config":{"name":"Ação","parameters":{"rules":{"values":[{"outputKey":"consultar_cpf","conditions":{"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict"},"conditions":[{"leftValue":"={{ $json.acao }}","operator":{"type":"string","operation":"equals"},"rightValue":"consultar_cpf"}],"combinator":"and"}},{"outputKey":"simular","conditions":{"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict"},"conditions":[{"leftValue":"={{ $json.acao }}","operator":{"type":"string","operation":"equals"},"rightValue":"simular"}],"combinator":"and"}},{"outputKey":"criar_proposta","conditions":{"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict"},"conditions":[{"leftValue":"={{ $json.acao }}","operator":{"type":"string","operation":"equals"},"rightValue":"criar_proposta"}],"combinator":"and"}},{"outputKey":"status_proposta","conditions":{"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict"},"conditions":[{"leftValue":"={{ $json.acao }}","operator":{"type":"string","operation":"equals"},"rightValue":"status_proposta"}],"combinator":"and"}}]},"options":{"fallbackOutput":"extra","renameFallbackOutput":"outros"}}}});

const generica = node({"type":"n8n-nodes-base.postgres","version":2.5,"config":{"name":"Ação no banco","parameters":{"operation":"executeQuery","query":"select credito.acao($1::text::int, $2::text, $3::text::jsonb) as r","options":{"queryReplacement":"={{ [ $('Entrada').first().json.lead_id, $('Entrada').first().json.acao, JSON.stringify({ numero: $('Entrada').first().json.numero, chave: $('Entrada').first().json.chave, tipo: $('Entrada').first().json.tipo, motivo: $('Entrada').first().json.motivo }) ] }}"}},"credentials":{"postgres":{"id":"aHfHyRjcbV1C5hHu","name":"postgres_cloudfy"}}}});

const saidaGen = node({"type":"n8n-nodes-base.set","version":3.4,"config":{"name":"Resultado","parameters":{"mode":"raw","jsonOutput":"={{ JSON.stringify($json.r) }}"}}});

const leadConsulta = node({"type":"n8n-nodes-base.postgres","version":2.5,"config":{"name":"É demonstração?","parameters":{"operation":"executeQuery","query":"select coalesce(l.teste and regexp_replace($2::text, '\\D', '', 'g') = (credito.config('cpf_demo') #>> '{}'), false) as demo from credito.leads l where l.id = $1::text::int","options":{"queryReplacement":"={{ [ $('Entrada').first().json.lead_id, $('Entrada').first().json.cpf || '' ] }}"}},"credentials":{"postgres":{"id":"aHfHyRjcbV1C5hHu","name":"postgres_cloudfy"}}}});

const demoCpf = ifElse({"version":2.2,"config":{"name":"CPF de demonstração?","parameters":{"conditions":{"options":{"caseSensitive":true,"leftValue":"","typeValidation":"loose"},"conditions":[{"leftValue":"={{ $json.demo }}","operator":{"type":"boolean","operation":"true","singleValue":true}}],"combinator":"and"}}}});

const consultaDemo = node({"type":"n8n-nodes-base.set","version":3.4,"config":{"name":"Consulta demo","parameters":{"mode":"raw","jsonOutput":"={{ JSON.stringify({ ok: true, situacao: 'com_margem', cpf: String($('Entrada').first().json.cpf).replace(/\\D/g, ''), nome: 'CLIENTE DEMONSTRACAO', consult_id: 'demo', status_v8: 'SUCCESS', margem: 400 }) }}"}}});

const v8Consulta = node({"type":"n8n-nodes-base.executeWorkflow","version":1.3,"config":{"name":"V8: consultar CPF","parameters":{"mode":"each","source":"database","workflowId":{"__rl":true,"mode":"id","value":"iHwSWUjkB6I5aXhI"},"workflowInputs":{"mappingMode":"defineBelow","value":{"acao":"consultar_cpf","cpf":"={{ $('Entrada').first().json.cpf }}","dados":""},"matchingColumns":[],"schema":[{"id":"acao","displayName":"acao","required":false,"defaultMatch":false,"display":true,"canBeUsedToMatch":true,"type":"string"},{"id":"cpf","displayName":"cpf","required":false,"defaultMatch":false,"display":true,"canBeUsedToMatch":true,"type":"string"},{"id":"dados","displayName":"dados","required":false,"defaultMatch":false,"display":true,"canBeUsedToMatch":true,"type":"string"}],"attemptToConvertTypes":false,"convertFieldsToString":true},"options":{}}}});

const aplicar = node({"type":"n8n-nodes-base.postgres","version":2.5,"config":{"name":"Aplicar consulta","parameters":{"operation":"executeQuery","query":"select credito.acao($1::text::int, 'aplicar_consulta', $2::text::jsonb) as r","options":{"queryReplacement":"={{ [ $('Entrada').first().json.lead_id, JSON.stringify(Object.assign({}, $json, { cliente: { nome: $json.nome || null, nascimento: $json.nascimento || null, telefone: $json.telefone || null, email: $json.email || null } })) ] }}"}},"credentials":{"postgres":{"id":"aHfHyRjcbV1C5hHu","name":"postgres_cloudfy"}}}});

const comMargem = ifElse({"version":2.2,"config":{"name":"Com margem?","parameters":{"conditions":{"options":{"caseSensitive":true,"leftValue":"","typeValidation":"loose"},"conditions":[{"leftValue":"={{ $json.r.situacao === 'com_margem' }}","operator":{"type":"boolean","operation":"true","singleValue":true}}],"combinator":"and"}}}});

const saidaConsulta = node({"type":"n8n-nodes-base.set","version":3.4,"config":{"name":"Resultado consulta","parameters":{"mode":"raw","jsonOutput":"={{ JSON.stringify($json.r) }}"}}});

const leadSim = node({"type":"n8n-nodes-base.postgres","version":2.5,"config":{"name":"Lead para simular","parameters":{"operation":"executeQuery","query":"select consult_id, margem, consult_id = 'demo' as demo from credito.leads where id = $1::text::int","options":{"queryReplacement":"={{ [ $('Entrada').first().json.lead_id ] }}"}},"credentials":{"postgres":{"id":"aHfHyRjcbV1C5hHu","name":"postgres_cloudfy"}}}});

const demoSim = ifElse({"version":2.2,"config":{"name":"Simulação demo?","parameters":{"conditions":{"options":{"caseSensitive":true,"leftValue":"","typeValidation":"loose"},"conditions":[{"leftValue":"={{ $json.demo }}","operator":{"type":"boolean","operation":"true","singleValue":true}}],"combinator":"and"}}}});

const salvarDemo = node({"type":"n8n-nodes-base.postgres","version":2.5,"config":{"name":"Salvar ofertas demo","parameters":{"operation":"executeQuery","query":"select credito.acao($1::text::int, 'salvar_ofertas', jsonb_build_object('ofertas', credito.ofertas_demo(coalesce(nullif($2::text, '')::numeric, (select margem from credito.leads where id = $1::text::int))))) as r","options":{"queryReplacement":"={{ [ $('Entrada').first().json.lead_id, String($('Entrada').first().json.parcela || '').replace(',', '.').replace(/[^0-9.]/g, '') ] }}"}},"credentials":{"postgres":{"id":"aHfHyRjcbV1C5hHu","name":"postgres_cloudfy"}}}});

const v8Sim = node({"type":"n8n-nodes-base.executeWorkflow","version":1.3,"config":{"name":"V8: simular","parameters":{"mode":"each","source":"database","workflowId":{"__rl":true,"mode":"id","value":"iHwSWUjkB6I5aXhI"},"workflowInputs":{"mappingMode":"defineBelow","value":{"acao":"simular","cpf":"","dados":"={{ JSON.stringify({ consult_id: $json.consult_id, margem: $json.margem, prazo: $('Entrada').first().json.prazo || null, parcela: String($('Entrada').first().json.parcela || '').replace(',', '.').replace(/[^0-9.]/g, '') || null }) }}"},"matchingColumns":[],"schema":[{"id":"acao","displayName":"acao","required":false,"defaultMatch":false,"display":true,"canBeUsedToMatch":true,"type":"string"},{"id":"cpf","displayName":"cpf","required":false,"defaultMatch":false,"display":true,"canBeUsedToMatch":true,"type":"string"},{"id":"dados","displayName":"dados","required":false,"defaultMatch":false,"display":true,"canBeUsedToMatch":true,"type":"string"}],"attemptToConvertTypes":false,"convertFieldsToString":true},"options":{}}}});

const salvarSim = node({"type":"n8n-nodes-base.postgres","version":2.5,"config":{"name":"Salvar ofertas","parameters":{"operation":"executeQuery","query":"select credito.acao($1::text::int, 'salvar_ofertas', $2::text::jsonb) as r","options":{"queryReplacement":"={{ [ $('Entrada').first().json.lead_id, JSON.stringify({ ofertas: $json.ofertas || [] }) ] }}"}},"credentials":{"postgres":{"id":"aHfHyRjcbV1C5hHu","name":"postgres_cloudfy"}}}});

const saidaSim = node({"type":"n8n-nodes-base.set","version":3.4,"config":{"name":"Resultado simulação","parameters":{"mode":"raw","jsonOutput":"={{ JSON.stringify($('Entrada').first().json.acao === 'consultar_cpf'\n  ? ($json.r.ok ? { ok: true, situacao: 'com_margem', setor: $json.r.setor, texto: 'Aprovado! As ofertas já foram calculadas e vão aparecer na próxima mensagem. Diga só que deu certo e que já vai mostrar os valores (não diga valores).' }\n                : { ok: false, situacao: 'com_margem', setor: $json.r.setor, texto: 'Aprovado, mas a simulação falhou agora. Diga que um especialista vai mandar os valores.' })\n  : $json.r) }}"}}});

const dadosOp = node({"type":"n8n-nodes-base.postgres","version":2.5,"config":{"name":"Dados da proposta","parameters":{"operation":"executeQuery","query":"select credito.dados_operacao($1::text::int) as d","options":{"queryReplacement":"={{ [ $('Entrada').first().json.lead_id ] }}"}},"credentials":{"postgres":{"id":"aHfHyRjcbV1C5hHu","name":"postgres_cloudfy"}}}});

const dadosOk = ifElse({"version":2.2,"config":{"name":"Dados ok?","parameters":{"conditions":{"options":{"caseSensitive":true,"leftValue":"","typeValidation":"loose"},"conditions":[{"leftValue":"={{ $json.d.ok }}","operator":{"type":"boolean","operation":"true","singleValue":true}}],"combinator":"and"}}}});

const semDados = node({"type":"n8n-nodes-base.set","version":3.4,"config":{"name":"Sem dados","parameters":{"mode":"raw","jsonOutput":"={{ JSON.stringify($json.d) }}"}}});

const opDemo = ifElse({"version":2.2,"config":{"name":"Proposta demo?","parameters":{"conditions":{"options":{"caseSensitive":true,"leftValue":"","typeValidation":"loose"},"conditions":[{"leftValue":"={{ $json.d.demo }}","operator":{"type":"boolean","operation":"true","singleValue":true}}],"combinator":"and"}}}});

const opFake = node({"type":"n8n-nodes-base.set","version":3.4,"config":{"name":"Proposta demo","parameters":{"mode":"raw","jsonOutput":"={{ JSON.stringify({ ok: true, demo: true, id: 'demo-' + $('Entrada').first().json.lead_id + '-' + Date.now(), url: 'https://escritorio-gm-cred.vercel.app/assinar-demo.html?p=' + $('Entrada').first().json.lead_id }) }}"}}});

const v8Op = node({"type":"n8n-nodes-base.executeWorkflow","version":1.3,"config":{"name":"V8: criar proposta","parameters":{"mode":"each","source":"database","workflowId":{"__rl":true,"mode":"id","value":"iHwSWUjkB6I5aXhI"},"workflowInputs":{"mappingMode":"defineBelow","value":{"acao":"criar_operacao","cpf":"","dados":"={{ JSON.stringify($json.d.payload) }}"},"matchingColumns":[],"schema":[{"id":"acao","displayName":"acao","required":false,"defaultMatch":false,"display":true,"canBeUsedToMatch":true,"type":"string"},{"id":"cpf","displayName":"cpf","required":false,"defaultMatch":false,"display":true,"canBeUsedToMatch":true,"type":"string"},{"id":"dados","displayName":"dados","required":false,"defaultMatch":false,"display":true,"canBeUsedToMatch":true,"type":"string"}],"attemptToConvertTypes":false,"convertFieldsToString":true},"options":{}}}});

const opOk = ifElse({"version":2.2,"config":{"name":"Proposta criada?","parameters":{"conditions":{"options":{"caseSensitive":true,"leftValue":"","typeValidation":"loose"},"conditions":[{"leftValue":"={{ $json.ok }}","operator":{"type":"boolean","operation":"true","singleValue":true}}],"combinator":"and"}}}});

const opErro = node({"type":"n8n-nodes-base.set","version":3.4,"config":{"name":"Falha na proposta","parameters":{"mode":"raw","jsonOutput":"={{ JSON.stringify({ ok: false, texto: 'A V8 não aceitou a proposta agora (' + ($json.erro || 'erro') + '). Diga que um especialista vai verificar e use pedir_humano.' }) }}"}}});

const registrarOp = node({"type":"n8n-nodes-base.postgres","version":2.5,"config":{"name":"Registrar proposta","parameters":{"operation":"executeQuery","query":"select credito.acao($1::text::int, 'registrar_operacao', $2::text::jsonb) as r","options":{"queryReplacement":"={{ [ $('Entrada').first().json.lead_id, JSON.stringify({ id: $json.id, url: $json.url, demo: !!$json.demo }) ] }}"}},"credentials":{"postgres":{"id":"aHfHyRjcbV1C5hHu","name":"postgres_cloudfy"}}}});

const saidaOp = node({"type":"n8n-nodes-base.set","version":3.4,"config":{"name":"Resultado proposta","parameters":{"mode":"raw","jsonOutput":"={{ JSON.stringify($json.r) }}"}}});

const leadOp = node({"type":"n8n-nodes-base.postgres","version":2.5,"config":{"name":"Proposta do cliente","parameters":{"operation":"executeQuery","query":"select operation_id, coalesce(status_operacao, '') as status, coalesce(operation_id like 'demo-%', false) as demo from credito.leads where id = $1::text::int","options":{"queryReplacement":"={{ [ $('Entrada').first().json.lead_id ] }}"}},"credentials":{"postgres":{"id":"aHfHyRjcbV1C5hHu","name":"postgres_cloudfy"}}}});

const temOp = ifElse({"version":2.2,"config":{"name":"Tem proposta?","parameters":{"conditions":{"options":{"caseSensitive":true,"leftValue":"","typeValidation":"loose"},"conditions":[{"leftValue":"={{ $json.operation_id || '' }}","operator":{"type":"string","operation":"notEmpty","singleValue":true}}],"combinator":"and"}}}});

const semOp = node({"type":"n8n-nodes-base.set","version":3.4,"config":{"name":"Sem proposta","parameters":{"mode":"raw","jsonOutput":"={{ JSON.stringify({ ok: false, texto: 'Ainda não existe proposta para esse cliente.' }) }}"}}});

const statusDemo = ifElse({"version":2.2,"config":{"name":"Status demo?","parameters":{"conditions":{"options":{"caseSensitive":true,"leftValue":"","typeValidation":"loose"},"conditions":[{"leftValue":"={{ $json.demo }}","operator":{"type":"boolean","operation":"true","singleValue":true}}],"combinator":"and"}}}});

const statusAtual = node({"type":"n8n-nodes-base.set","version":3.4,"config":{"name":"Status atual","parameters":{"mode":"raw","jsonOutput":"={{ JSON.stringify({ ok: true, status: $json.status }) }}"}}});

const v8Status = node({"type":"n8n-nodes-base.executeWorkflow","version":1.3,"config":{"name":"V8: status da proposta","parameters":{"mode":"each","source":"database","workflowId":{"__rl":true,"mode":"id","value":"iHwSWUjkB6I5aXhI"},"workflowInputs":{"mappingMode":"defineBelow","value":{"acao":"status_operacao","cpf":"","dados":"={{ JSON.stringify({ operation_id: $json.operation_id }) }}"},"matchingColumns":[],"schema":[{"id":"acao","displayName":"acao","required":false,"defaultMatch":false,"display":true,"canBeUsedToMatch":true,"type":"string"},{"id":"cpf","displayName":"cpf","required":false,"defaultMatch":false,"display":true,"canBeUsedToMatch":true,"type":"string"},{"id":"dados","displayName":"dados","required":false,"defaultMatch":false,"display":true,"canBeUsedToMatch":true,"type":"string"}],"attemptToConvertTypes":false,"convertFieldsToString":true},"options":{}}}});

const atualizar = node({"type":"n8n-nodes-base.postgres","version":2.5,"config":{"name":"Atualizar proposta","parameters":{"operation":"executeQuery","query":"select credito.acao($1::text::int, 'atualizar_operacao', $2::text::jsonb) as r","options":{"queryReplacement":"={{ [ $('Entrada').first().json.lead_id, JSON.stringify({ status: $json.status || '' }) ] }}"}},"credentials":{"postgres":{"id":"aHfHyRjcbV1C5hHu","name":"postgres_cloudfy"}}}});

const saidaStatus = node({"type":"n8n-nodes-base.set","version":3.4,"config":{"name":"Resultado status","parameters":{"mode":"raw","jsonOutput":"={{ JSON.stringify($json.r) }}"}}});

export default workflow('gmcred-acoes', 'GM Cred · Ações')
  .add(entrada)
  .to(rota
    .onCase(0, leadConsulta.to(demoCpf
      .onTrue(consultaDemo.to(aplicar))
      .onFalse(v8Consulta.to(aplicar))))
    .onCase(1, leadSim)
    .onCase(2, dadosOp.to(dadosOk
      .onFalse(semDados)
      .onTrue(opDemo
        .onTrue(opFake.to(registrarOp))
        .onFalse(v8Op.to(opOk.onTrue(registrarOp).onFalse(opErro))))))
    .onCase(3, leadOp.to(temOp
      .onFalse(semOp)
      .onTrue(statusDemo
        .onTrue(statusAtual.to(atualizar))
        .onFalse(v8Status.to(atualizar)))))
    .onCase(4, generica.to(saidaGen)))
  .add(aplicar)
  .to(comMargem.onTrue(leadSim).onFalse(saidaConsulta))
  .add(leadSim)
  .to(demoSim
    .onTrue(salvarDemo.to(saidaSim))
    .onFalse(v8Sim.to(salvarSim).to(saidaSim)))
  .add(registrarOp)
  .to(saidaOp)
  .add(atualizar)
  .to(saidaStatus);
