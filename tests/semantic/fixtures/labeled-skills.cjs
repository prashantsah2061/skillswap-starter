// Hand-labeled synthetic suitability examples, not production users or outcomes.
// Positive means a useful learning exchange, not interchangeable qualifications.
const names = {
  python: 'Python', pythonProgramming: 'Python programming', guitar: 'Guitar', acousticGuitar: 'Acoustic guitar',
  spanish: 'Spanish', conversationalSpanish: 'Conversational Spanish', photography: 'Photography', digitalPhotography: 'Digital photography',
  sql: 'SQL', postgres: 'PostgreSQL', databaseDesign: 'Database design', photoEditing: 'Photo editing', photoshop: 'Adobe Photoshop',
  java: 'Java', javascript: 'JavaScript', typescript: 'TypeScript', snakeCare: 'Python snake care', guitarMaking: 'Guitar making',
  baking: 'Baking', accounting: 'Accounting', webDevelopment: 'Web development', frontend: 'Frontend web development',
  french: 'French', frenchConversation: 'French conversation', dataAnalysis: 'Data analysis', retouching: 'Image retouching', fitness: 'Fitness',
};
const skills = Object.fromEntries(Object.entries(names).map(([key, name], index) => [key, {
  id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`, name,
}]));
function example(id, split, kind, aTeach, aLearn, bTeach, bLearn, label, rationale) {
  return { id, split, kind, actor: { teach: [aTeach], learn: [aLearn] }, candidate: { teach: [bTeach], learn: [bLearn] }, label, rationale };
}
const cases = [
  example('c01','calibration','exact','guitar','python','python','guitar',true,'Both requested canonical IDs are offered.'),
  example('c02','calibration','exact','spanish','photography','photography','spanish',true,'Two exact overlaps.'),
  example('c03','calibration','related','guitar','python','pythonProgramming','guitar',true,'Explicit programming variant supports introductory Python.'),
  example('c04','calibration','related','spanish','sql','postgres','spanish',true,'PostgreSQL teaching can support foundational SQL; dialect details differ.'),
  example('c05','calibration','related','spanish','guitar','acousticGuitar','spanish',true,'Acoustic teaching can support guitar fundamentals.'),
  example('c06','calibration','related','guitar','photoEditing','photoshop','guitar',true,'Photoshop supports common photo-editing practice; not every editor.'),
  example('c07','calibration','misleading','guitar','java','javascript','guitar',false,'Similar labels name different languages and curricula.'),
  example('c08','calibration','misleading','guitar','python','snakeCare','guitar',false,'Programming versus reptile care.'),
  example('c09','calibration','misleading','spanish','guitar','guitarMaking','spanish',false,'Making an instrument does not imply teaching how to play it.'),
  example('c10','calibration','one-way','guitar','python','python','baking',false,'Learning direction works; teaching direction does not.'),
  example('c11','calibration','unrelated','spanish','accounting','guitar','spanish',false,'Accounting and guitar have unrelated learning objectives.'),
  example('c12','calibration','related-both','spanish','webDevelopment','frontend','conversationalSpanish',true,'Both directions offer useful partial specializations.'),
  example('t01','heldout','exact','spanish','sql','sql','spanish',true,'Both canonical IDs overlap.'),
  example('t02','heldout','exact','photography','baking','baking','photography',true,'Both canonical IDs overlap.'),
  example('t03','heldout','related','guitar','javascript','typescript','guitar',true,'TypeScript instruction can support JavaScript foundations; confirm prerequisites.'),
  example('t04','heldout','related','spanish','photography','digitalPhotography','spanish',true,'Digital photography supports common photography goals.'),
  example('t05','heldout','related','guitar','french','frenchConversation','guitar',true,'Conversation practice is useful for French learning, not the whole curriculum.'),
  example('t06','heldout','misleading','guitar','python','dataAnalysis','guitar',false,'Data analysis alone does not establish that Python is taught.'),
  example('t07','heldout','misleading','guitar','sql','databaseDesign','guitar',false,'Database design alone does not establish SQL instruction.'),
  example('t08','heldout','misleading','spanish','javascript','java','spanish',false,'Related vocabulary must not equate distinct programming languages.'),
  example('t09','heldout','one-way','guitar','french','python','guitar',false,'Only the reverse teaching direction works.'),
  example('t10','heldout','related-both','guitar','photoEditing','retouching','acousticGuitar',true,'Both exchanges have plausible useful partial overlap.'),
  example('t11','heldout','unrelated','spanish','fitness','accounting','spanish',false,'Fitness and accounting are unrelated goals.'),
  example('t12','heldout','one-way','accounting','python','python','fitness',false,'Exact learning overlap cannot compensate for incompatible teaching.'),
];
module.exports = { version: 'skillswap-synthetic-v1', skills, cases };
