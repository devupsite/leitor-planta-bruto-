<?php
/* ════════════════════════════════════════════════════════════════
   bruto-secrets/API/planta-vision.php
   NUNCA commitar este arquivo em nenhum repositório Git.
   Upload manual direto no servidor (Hostinger, fora do public_html),
   igual ao processo já usado pra chat.php / suite-ia.php — ver
   up/DEPLOY.md do repo bruto para o passo a passo de upload manual.

   Reaproveita a mesma ANTHROPIC_API_KEY já definida em bruto-config.php
   (o mesmo arquivo que chat.php/suite-ia.php usam via require + define()).
════════════════════════════════════════════════════════════════ */

// ── CORS: restrito ao domínio do GitHub Pages do projeto novo ──────────────
$allowed_origin = 'https://devupsite.github.io';

header("Access-Control-Allow-Origin: {$allowed_origin}");
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Método não permitido.']);
    exit;
}

require_once dirname(__DIR__) . '/bruto-config.php'; // define('ANTHROPIC_API_KEY', ...)

if (!defined('ANTHROPIC_API_KEY') || !ANTHROPIC_API_KEY) {
    http_response_code(500);
    echo json_encode(['error' => 'Configuração do servidor incompleta.']);
    exit;
}

$api_key = ANTHROPIC_API_KEY;

// ── Throttle simples por IP (hospedagem compartilhada não tem WAF) ─────────
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$throttle_file = sys_get_temp_dir() . '/planta_vision_' . md5($ip) . '.lock';
if (file_exists($throttle_file) && (time() - filemtime($throttle_file)) < 3) {
    http_response_code(429);
    echo json_encode(['error' => 'Muitas requisições. Aguarde um instante.']);
    exit;
}
touch($throttle_file);

// ── Corpo da requisição ──────────────────────────────────────────────────
$input = json_decode(file_get_contents('php://input'), true);

$image_base64 = $input['image_base64'] ?? null;
$media_type   = $input['media_type']   ?? 'image/jpeg';

if (!$image_base64) {
    http_response_code(400);
    echo json_encode(['error' => 'Campo image_base64 é obrigatório.']);
    exit;
}

// Schema fixo — garante que o front-end sempre recebe o mesmo formato,
// independente de como o modelo decidiria formatar um JSON solto no texto.
$tool = [
    'name' => 'reportar_ambientes',
    'description' => 'Reporta os ambientes identificados numa planta baixa, com área e tipo de piso indicado, para orientar onde aplicar revestimento.',
    'input_schema' => [
        'type' => 'object',
        'properties' => [
            'ambientes' => [
                'type' => 'array',
                'items' => [
                    'type' => 'object',
                    'properties' => [
                        'nome' => [
                            'type' => 'string',
                            'description' => 'Nome do ambiente como aparece na planta (ex: SALA, COZINHA, BWC).',
                        ],
                        'area_m2' => [
                            'type' => 'number',
                            'description' => 'Área em metros quadrados, só o número. Omitir se não houver cota de área visível.',
                        ],
                        'tipo_piso_indicado' => [
                            'type' => 'string',
                            'description' => 'Tipo de piso indicado na planta, se houver texto sobre isso (ex: P. CERÂMICO). Deixar vazio se não houver indicação.',
                        ],
                    ],
                    'required' => ['nome'],
                ],
            ],
            'dimensoes_totais' => [
                'type' => 'object',
                'properties' => [
                    'largura_m' => ['type' => 'number'],
                    'profundidade_m' => ['type' => 'number'],
                ],
            ],
            'escala_indicada' => ['type' => 'string'],
        ],
        'required' => ['ambientes'],
    ],
];

$payload = [
    'model' => 'claude-sonnet-5',
    'max_tokens' => 4096,
    'thinking' => ['type' => 'disabled'], // extração estruturada não precisa de raciocínio — evita gastar o budget de tokens pensando
    'output_config' => ['effort' => 'low'], // mais rápido e mais barato, adequado pra visualização quase em tempo real
    'tools' => [$tool],
    'tool_choice' => ['type' => 'tool', 'name' => 'reportar_ambientes'],
    'messages' => [[
        'role' => 'user',
        'content' => [
            [
                'type' => 'image',
                'source' => [
                    'type' => 'base64',
                    'media_type' => $media_type,
                    'data' => $image_base64,
                ],
            ],
            [
                'type' => 'text',
                'text' => 'Analise esta planta baixa e reporte os ambientes identificados, usando a ferramenta disponível.',
            ],
        ],
    ]],
];

$ch = curl_init('https://api.anthropic.com/v1/messages');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'x-api-key: ' . $api_key,
        'anthropic-version: 2023-06-01',
    ],
    CURLOPT_POSTFIELDS => json_encode($payload),
    CURLOPT_TIMEOUT => 30,
]);

$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curl_error = curl_error($ch);
curl_close($ch);

if ($curl_error) {
    http_response_code(502);
    echo json_encode(['error' => 'Falha ao contatar a API da Anthropic.']);
    exit;
}

if ($http_code !== 200) {
    http_response_code($http_code);
    header('Content-Type: application/json');
    echo $response; // repassa o erro original da Anthropic, útil pra debugar
    exit;
}

$decoded = json_decode($response, true);
$tool_result = null;
foreach (($decoded['content'] ?? []) as $block) {
    if (($block['type'] ?? null) === 'tool_use' && ($block['name'] ?? null) === 'reportar_ambientes') {
        $tool_result = $block['input'];
        break;
    }
}

if (!$tool_result) {
    http_response_code(502);
    echo json_encode(['error' => 'A resposta da Anthropic não trouxe o resultado esperado.']);
    exit;
}

http_response_code(200);
header('Content-Type: application/json');
echo json_encode($tool_result);
