# Cópias de referência — código que roda na Hostinger

Estes arquivos **não são deployados a partir deste repositório**. O GitHub Pages só serve `/frontend/`. Estas são cópias de referência do que está de verdade no servidor, pra qualquer sessão entender o backend sem precisar acessar a Hostinger.

- `planta-vision-proxy.php` → deployado de verdade a partir do repo `devupsite/bruto` (`api/planta-vision-proxy.php`), via deploy automático existente. Sem segredo nenhum.
- `planta-vision.php` → upload MANUAL direto em `bruto-secrets/API/planta-vision.php` na Hostinger, fora do `public_html`, nunca via Git. Também sem o valor do segredo (usa `require` do `bruto-config.php`, que fica só no servidor).

**Se atualizar o arquivo de verdade no servidor ou no repo `bruto`, atualize a cópia aqui também**, senão essas referências ficam desatualizadas.

Endpoint em produção: `https://brutoceramica.com.br/api/planta-vision-proxy.php`
