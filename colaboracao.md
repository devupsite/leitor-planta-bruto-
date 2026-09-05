# Colaboração entre sessões — Visualizador de Plantas com Revestimento (Bruto)

Este arquivo existe para que múltiplas sessões (incluindo diferentes instâncias do Claude, em diferentes momentos) consigam trabalhar neste repositório sem sobrescrever ou quebrar o que outra sessão já construiu.

**Toda sessão que for mexer neste repositório deve ler este arquivo inteiro antes de escrever qualquer código.**

---

## Regra de ouro

**Nunca confie em conteúdo de arquivo que você já tem "na memória" de uma leitura anterior nesta mesma conversa, se a conversa não é contínua com o momento em que você vai editar.** Outra sessão pode ter alterado o arquivo entre a sua leitura e a sua escrita. Sempre busque a versão mais recente do arquivo diretamente do GitHub (SHA/conteúdo atual) imediatamente antes de editar.

---

## Contexto do projeto (leia antes de tudo)

Ferramenta para o site da Bruto: o lead (arquiteto/engenheiro) faz upload da planta do projeto e recebe uma visualização 3D interativa com o revestimento da Bruto já aplicado. Objetivo: acelerar cotações — o lead visualiza o produto aplicado no próprio projeto antes mesmo de falar com um vendedor.

**Formatos de entrada esperados (mistos):**
1. IFC / OBJ / FBX / SketchUp — arquivos já em 3D
2. DWG / DXF — CAD 2D vetorial
3. PDF / imagem escaneada — planta rasterizada (o mais difícil)

**Decisão de arquitetura atual — leia com atenção:**
Por ora o deploy é **somente GitHub Pages (site estático, sem backend/serverless)**. Isso tem uma consequência direta: **não é seguro chamar a API do Claude direto do navegador**, pois exigiria expor a chave de API no código client-side.

Por causa disso:
- **Fases 1 e 2 (IFC e DWG/DXF) são o foco atual** — são resolvíveis 100% client-side, sem IA paga, usando `web-ifc` (WASM) para IFC e `dxf-parser` (JS puro) para DXF.
- **Fase 3 (PDF/imagem escaneada) está PAUSADA** — depende de Claude Vision para ler rótulos/ambientes, o que exige uma função serverless (Vercel/Cloudflare Workers) para não expor a chave. Não implemente chamada de API do Claude direto do front-end sob nenhuma circunstância, mesmo que pareça funcionar em teste local — isso expõe a chave publicamente assim que for para o GitHub Pages. Se uma sessão futura for destravar a Fase 3, o primeiro passo é decidir a hospedagem da função serverless, não escrever o código de integração.
- Se o usuário disser que já resolveu a hospedagem da API (ex: migrou para Vercel), atualize esta seção antes de mexer na Fase 3.

---

## Antes de começar a trabalhar

1. Leia este `colaboracao.md` por inteiro.
2. Leia a seção **"Log de sessões"** no final deste arquivo para saber o que foi feito por último e o que está em andamento.
3. Se algo estiver marcado como **"EM ANDAMENTO"** por outra sessão recente (menos de algumas horas), evite mexer nos mesmos arquivos até confirmar que não há conflito.
4. Busque o conteúdo atual de qualquer arquivo diretamente do GitHub antes de editar — nunca parta de uma cópia antiga.

## Enquanto trabalha

5. Faça commits pequenos e atômicos, com mensagens descritivas (ex: `feat: adiciona parser de IFC via web-ifc`, não `updates`).
5.1. **Não acumule o trabalho da sessão inteira para um único commit no final.** Faça push a cada parte funcional concluída (ex: primeiro o viewer com modelo de exemplo, depois o parser de IFC, depois a troca de material — cada um em um commit separado, assim que funcionar). Isso permite que outra sessão veja o progresso e continue o trabalho mesmo que a sessão atual seja interrompida antes do previsto.
6. Nunca faça `force push` nem reescreva histórico (`rebase -f`, `push --force`). Histórico é sagrado.
7. Não delete ou reescreva arquivos inteiros de funcionalidades que não são o foco da sua tarefa atual, mesmo que pareçam "melhoráveis". Se identificar algo que vale mudar fora do escopo, anote na seção de notas em vez de mexer.
8. Mantenha a estrutura de pastas organizada por tipo (ver seção abaixo).
9. **Nunca commitar arquivos binários grandes** (modelos 3D de exemplo, texturas em alta resolução do catálogo da Bruto) diretamente no Git. Use Git LFS, ou armazene em um serviço externo (Hugging Face Hub, Google Drive, Cloudflare R2) e deixe só o link/README no repo.
10. Branch `main` é sempre a versão estável e pronta para deploy (é o que o GitHub Pages publica). Trabalho experimental vai em uma branch separada até funcionar, depois faz merge.
11. Ao adicionar uma biblioteca client-side nova (ex: `web-ifc`, `dxf-parser`, `three`), prefira importar via CDN (ex: unpkg, jsdelivr) ou vendorizar o build já compilado, já que não há etapa de build/servidor — o GitHub Pages serve os arquivos como estão.

## Antes de terminar sua sessão

12. Atualize a seção **"Log de sessões"** abaixo com: data, o que foi feito, quais arquivos foram tocados, e se ficou algo pela metade (marque como EM ANDAMENTO com detalhe do que falta).
13. Nunca apague entradas antigas do log — só adicione a sua no topo. O log é o histórico de continuidade entre sessões.
14. Se um teste visual real (abrir a página publicada no navegador) ainda não foi feito, deixe isso explícito no status — sessões de código não conseguem rodar Three.js/WebGL de verdade, só validar sintaxe e lógica estaticamente.

---

## Deploy

- **Método atual: GitHub Pages**, via `.github/workflows/deploy.yml` (ou publicação direta da branch `main`, conforme configurado em Settings → Pages).
- Em Settings → Pages, confirme se o Source é "GitHub Actions" (com workflow) ou "Deploy from a branch" — documente aqui qual dos dois está ativo assim que o repo for criado, para a próxima sessão não precisar adivinhar.
- O deploy **só acontece a partir da branch `main`**, nunca de uma branch experimental.
- Antes de fazer push para `main`, confirme que a parte que você construiu funciona sozinha (mesmo que o fluxo completo ainda não esteja pronto).
- **Sem backend/serverless por enquanto** — ver seção "Decisão de arquitetura atual" acima. Não adicione nenhum `.env`, chave de API ou segredo em código client-side.

---

## Estrutura de pastas do projeto (atualizar conforme o projeto cresce)

```
/frontend/          → site do visualizador (HTML/JS/CSS, publicado no GitHub Pages)
  /frontend/lib/     → bibliotecas de terceiros vendorizadas (web-ifc, dxf-parser, three.js)
  /frontend/parsers/ → código de parsing por formato (ifc.js, dxf.js — cada um isolado)
/dataset/            → README apontando para onde estão as texturas/modelos de exemplo (não os binários em si — ver regra 9)
/docs/               → documentação técnica adicional, decisões de arquitetura, se necessário
colaboracao.md       → este arquivo
```

---

## Log de sessões

> Toda sessão adiciona uma entrada nova no topo desta lista. Nunca apague entradas antigas.

### [Adicionar aqui: data da criação do repo] — Setup inicial (conversa de planejamento, sem código ainda)
- Contexto: planejamento inicial do projeto com o usuário, antes da criação do repo. Definido o roadmap em 4 fases (IFC/OBJ nativo → DWG/DXF → PDF/imagem escaneada com IA → biblioteca de texturas), e a restrição de arquitetura de rodar 100% client-side no GitHub Pages por enquanto, adiando a Fase 3 (que depende de Claude Vision) até haver uma função serverless disponível.
- Arquivos alterados: nenhum ainda — este `colaboracao.md` é o primeiro artefato do projeto.
- Status: EM ANDAMENTO — próximo passo é a Fase 0 (viewer Three.js com modelo glTF de exemplo e troca de material), depois plugar o parser de IFC (`web-ifc`) como primeiro caso real de upload.
- Notas para a próxima sessão: ver a conversa de planejamento original para o racional completo de cada fase. Prioridade: Fase 0 (viewer) antes de qualquer parser, para ter algo visualmente testável o quanto antes.

### [Adicionar aqui: data] — [Adicionar aqui: resumo da sessão]
- Arquivos alterados:
- Status: (concluído / EM ANDAMENTO — o que falta)
- Notas para a próxima sessão:
