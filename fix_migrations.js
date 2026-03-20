const fs = require('fs');
let file = fs.readFileSync('lib/migrations.ts', 'utf8');

const newMigration = `  {
    name: 'add_performance_indexes_v33',
    version: 33,
    sql: \`
      CREATE INDEX IF NOT EXISTS idx_communication_likes_post_id ON communication_likes(post_id);
      CREATE INDEX IF NOT EXISTS idx_communication_likes_user_email ON communication_likes(user_email);
      CREATE INDEX IF NOT EXISTS idx_communications_slug ON communications(slug);
      CREATE INDEX IF NOT EXISTS idx_communications_status ON communications(status);
      CREATE INDEX IF NOT EXISTS idx_user_roles_email ON user_roles(email);
      CREATE INDEX IF NOT EXISTS idx_salary_deals_teacher_email ON salary_deals(teacher_email);
      CREATE INDEX IF NOT EXISTS idx_exam_submissions_user_email ON exam_submissions(user_email);
      CREATE INDEX IF NOT EXISTS idx_training_submissions_user_email ON training_submissions(user_email);
      CREATE INDEX IF NOT EXISTS idx_training_assignments_type ON training_assignments(type);
    \`
  }`;

// Find "];" just before "export async function runMigrations"
let parts = file.split("];\n\nexport async function runMigrations");
if (parts.length === 2) {
   let modified = parts[0] + ",\n" + newMigration + "\n];\n\nexport async function runMigrations" + parts[1];
   // Remove trailing comma from the last element before our new one if we accidentally created a double comma
   modified = modified.replace(/,\s*,/g, ',');
   fs.writeFileSync('lib/migrations.ts', modified);
   console.log("Success exact match");
} else {
   console.log("Could not split properly");
}
