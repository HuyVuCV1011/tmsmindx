const run = async () => {
  try {
    const res = await fetch('http://localhost:3000/api/database', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'migrate', secret: 'mindx-teaching-internal-2025' })
    });
    const json = await res.json();
    console.log(JSON.stringify(json, null, 2));
  } catch(e) {
    console.error(e);
  }
};
run();
