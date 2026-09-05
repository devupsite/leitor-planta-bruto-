# Leitor de Planta — Bruto

Ferramenta para o site da Bruto: o lead (arquiteto/engenheiro) faz upload da planta do projeto e recebe uma visualização 3D interativa com o revestimento da Bruto já aplicado.

**Antes de mexer em qualquer coisa neste repositório, leia [`colaboracao.md`](./colaboracao.md) por inteiro.** Ele define o protocolo de trabalho entre sessões, o estado atual do projeto e o que falta.

## Estrutura

```
/frontend/   → site do visualizador (publicado no GitHub Pages)
/dataset/    → onde ficam os apontamentos para as texturas do catálogo Bruto
/docs/       → documentação técnica adicional
```

## Status atual

Fase 0 em andamento — viewer 3D funcional com uma sala de exemplo e troca de revestimento no piso. Parsers reais (IFC, DXF) ainda não foram plugados. Ver `colaboracao.md` para o roadmap completo.
