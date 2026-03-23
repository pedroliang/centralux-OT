const fs = require('fs');

async function run() {
    const token = 'sbp_9cb3069a3601ac183118513ed68481d9741d571a';
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
