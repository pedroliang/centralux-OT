const fs = require('fs');

async function run() {
    const token = process.env.SUPABASE_ACCESS_TOKEN;
    const ref = 'fruwdnbysjpaccregbnj';
    const query = fs.readFileSync('setup_database.sql', 'utf8');

    try {
        const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query })
        });

        const data = await response.text();
        console.log('Status:', response.status);
        console.log('Response:', data);
    } catch (e) {
        console.error(e);
    }
}

run();
