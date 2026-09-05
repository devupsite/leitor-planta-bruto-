<?php
/* ════════════════════════════════════════════════════════════════
   Ponte pública — NÃO contém segredo nenhum.
   O arquivo de verdade (com a chamada à API da Anthropic) mora
   fora do public_html, em bruto-secrets/API/, protegido do deploy
   automático do Git.
   Este arquivo pode ir pro GitHub sem problema.
════════════════════════════════════════════════════════════════ */
require dirname($_SERVER['DOCUMENT_ROOT']) . '/bruto-secrets/API/planta-vision.php';
