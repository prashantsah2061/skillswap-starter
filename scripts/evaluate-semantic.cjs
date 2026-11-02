const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { loadTs } = require('../tests/discovery/load-ts.cjs');
const dataset = require('../tests/semantic/fixtures/labeled-skills.cjs');
const matching = loadTs('backend/src/lib/discovery/matching.ts');
const semantic = loadTs('backend/src/lib/discovery/semantic-matching.ts');
const provider = loadTs('backend/src/lib/discovery/embeddings.ts');
const thresholds = Array.from({ length: 10 }, (_, i) => (50 + i * 5) / 100);
const actorId = '00000000-0000-4000-8000-000000000001';
const candidate = { id: '00000000-0000-4000-8000-000000000002', display_name: 'Synthetic candidate', bio: '' };
const listings = (person, id) => ['teach','learn'].flatMap(direction => person[direction].map(key => ({ user_id: id, skill_id: dataset.skills[key].id, direction, skill: dataset.skills[key] })));

function metrics(rows, predictions) {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  rows.forEach(row => { const positive = predictions(row); if (row.label && positive) tp++; else if (positive) fp++; else if (row.label) fn++; else tn++; });
  const precision = tp + fp ? tp / (tp + fp) : 0, recall = tp + fn ? tp / (tp + fn) : 0;
  return { count: rows.length, tp, fp, fn, tn, precision, recall, f1: precision + recall ? 2 * precision * recall / (precision + recall) : 0 };
}
function baseline(row) { return !!matching.complementaryCandidate(matching.skillsByDirection(listings(row.actor, actorId)), candidate, listings(row.candidate, candidate.id)); }
function evaluate(vectors) {
  const scores = new Map(dataset.cases.map(row => {
    const result = semantic.semanticCandidate(matching.skillsByDirection(listings(row.actor, actorId)), candidate, listings(row.candidate, candidate.id), vectors, -1);
    return [row.id, result.semantic.score];
  }));
  const calibration = dataset.cases.filter(row => row.split === 'calibration');
  const heldout = dataset.cases.filter(row => row.split === 'heldout');
  const sweep = thresholds.map(threshold => ({ threshold, calibration: metrics(calibration, row => scores.get(row.id) >= threshold), heldout: metrics(heldout, row => scores.get(row.id) >= threshold) }));
  // Select using calibration only; held-out labels do not select the threshold.
  const selected = [...sweep].sort((a,b) => b.calibration.f1 - a.calibration.f1 || b.calibration.precision - a.calibration.precision || b.threshold - a.threshold)[0];
  return { selected_threshold: selected.threshold, calibration: selected.calibration, heldout: selected.heldout, sweep,
    cases: dataset.cases.map(row => ({ id: row.id, kind: row.kind, split: row.split, label: row.label, score: scores.get(row.id), prediction: scores.get(row.id) >= selected.threshold, rationale: row.rationale })) };
}

// A dependency-free lexical embedding ablation. It is NOT the production model
// and must never be used to claim OpenAI semantic model quality or calibrate it.
function lexicalVectors() {
  const grams = value => {
    const text = ' ' + value.name.toLowerCase() + ' ';
    return Array.from({ length: text.length - 2 }, (_, i) => text.slice(i, i + 3));
  };
  const vocabulary = [...new Set(Object.values(dataset.skills).flatMap(grams))].sort();
  return new Map(Object.values(dataset.skills).map(skill => {
    const counts = grams(skill);
    return [semantic.skillContent(skill), vocabulary.map(gram => counts.filter(value => value === gram).length)];
  }));
}

async function main() {
  const report = { dataset: dataset.version, dataset_sha256: createHash('sha256').update(JSON.stringify(dataset)).digest('hex'),
    input: 'names-only', baseline: {
      all: metrics(dataset.cases, baseline), calibration: metrics(dataset.cases.filter(row => row.split === 'calibration'), baseline),
      heldout: metrics(dataset.cases.filter(row => row.split === 'heldout'), baseline),
    }, lexical_control: { description: 'Character-trigram cosine ablation; not the production semantic model.', ...evaluate(lexicalVectors()) },
    semantic_provider: { status: 'blocked', reason: 'No live provider run requested; model quality and threshold remain unverified.' },
  };
  if (process.argv.includes('--provider')) {
    // Read private local configuration without logging any names or values.
    require('@next/env').loadEnvConfig(path.resolve('backend'), true, { info() {}, error() {} });
    if (!process.env.OPENAI_API_KEY || !process.env.SKILL_EMBEDDING_REVISION) {
      report.semantic_provider = { status: 'blocked', reason: 'Private provider key/revision unavailable.' };
      process.exitCode = 2;
    } else {
      try {
        const vectors = await provider.embedSkills(Object.values(dataset.skills), { key: process.env.OPENAI_API_KEY, revision: process.env.SKILL_EMBEDDING_REVISION });
        const evaluated = evaluate(vectors);
        report.semantic_provider = { status: 'evaluated', ...evaluated };
        const artifact = { provider: 'openai', model: provider.EMBEDDING_MODEL, dimensions: provider.EMBEDDING_DIMENSIONS,
          format: semantic.EMBEDDING_FORMAT, revision: process.env.SKILL_EMBEDDING_REVISION,
          input: 'names-only', evaluated_thresholds: thresholds, heldout_count: 12, ...evaluated,
          dataset_sha256: report.dataset_sha256, dataset: dataset.version };
        fs.mkdirSync('artifacts/semantic', { recursive: true });
        fs.writeFileSync('artifacts/semantic/provider-evaluation.json', JSON.stringify(artifact, null, 2) + '\n');
      } catch { report.semantic_provider = { status: 'blocked', reason: 'Provider failed; no quality report produced.' }; process.exitCode = 2; }
    }
  }
  fs.mkdirSync('artifacts/semantic', { recursive: true });
  fs.writeFileSync('artifacts/semantic/evaluation.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ baseline: report.baseline, lexical_control: { threshold: report.lexical_control.selected_threshold, heldout: report.lexical_control.heldout }, semantic_provider: report.semantic_provider.status }, null, 2));
}
main().catch(() => { console.error('Evaluation could not complete. No credentials were logged.'); process.exitCode = 1; });
