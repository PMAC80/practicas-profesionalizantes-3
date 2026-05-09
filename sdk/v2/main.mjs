import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { URL } from 'node:url';
import sqlite3 from 'sqlite3';



function load_config()
{
    try
    {
        return JSON.parse(
            readFileSync('./config.json', 'utf-8')
        );
    }
    catch
    {
        return {
            server: {
                ip: '127.0.0.1',
                port: 3000,
                default_path: './default.html'
            },

            database: {
                path: './db.sqlite3'
            }
        };
    }
}



let config = load_config();



const db = new sqlite3.Database(
    resolve(config.database.path)
);



function login(username, password)
{
    return new Promise((resolve) =>
    {
        db.get(
            `
            SELECT id, username
            FROM user
            WHERE username = ?
            AND password = ?
            `,
            [username, password],

            (err, row) =>
            {
                if (row)
                {
                    resolve({
                        status: true,
                        username: row.username
                    });
                }
                else
                {
                    resolve({
                        status: false,
                        error: 'Usuario o password invalidos'
                    });
                }
            }
        );
    });
}



function get_permissions(username)
{
    return new Promise((resolve) =>
    {
        const sql = `
            SELECT DISTINCT e.path

            FROM user u

            JOIN members m
            ON u.id = m.id_user

            JOIN "group" g
            ON m.id_group = g.id

            JOIN access a
            ON g.id = a.id_group

            JOIN endpoint e
            ON a.id_endpoint = e.id

            WHERE u.username = ?
        `;

        db.all(sql, [username], (err, rows) =>
        {
            resolve({
                status: true,

                endpoints: rows
                    ? rows.map(r => r.path)
                    : []
            });
        });
    });
}



function register(username, password)
{
    return new Promise((resolve) =>
    {
        db.run(
            `
            INSERT INTO user
            (username, password)

            VALUES (?, ?)
            `,
            [username, password],

            function(err)
            {
                if (err)
                {
                    resolve({
                        status: false,
                        error: err.message
                    });
                }
                else
                {
                    resolve({
                        status: true
                    });
                }
            }
        );
    });
}



function parse_body(req)
{
    return new Promise((resolve) =>
    {
        let body = '';

        req.on('data', chunk =>
        {
            body += chunk.toString();
        });

        req.on('end', () =>
        {
            try
            {
                resolve(JSON.parse(body));
            }
            catch
            {
                resolve(
                    Object.fromEntries(
                        new URLSearchParams(body)
                    )
                );
            }
        });
    });
}



function reply(res, data)
{
    res.writeHead(200, {
        'Content-Type': 'application/json'
    });

    res.end(
        JSON.stringify(data)
    );
}



let router = new Map();



router.set('/', (req, res) =>
{
    res.writeHead(200, {
        'Content-Type': 'text/html'
    });

    res.end(
        readFileSync(
            config.server.default_path,
            'utf-8'
        )
    );
});



router.set('/api/login', async (req, res) =>
{
    if (req.method !== 'POST')
    {
        return reply(res, {
            status: false
        });
    }

    const {
        username,
        password
    } = await parse_body(req);

    const result = await login(
        username,
        password
    );

    if (result.status)
    {
        const perms =
            await get_permissions(username);

        result.endpoints =
            perms.endpoints;
    }

    reply(res, result);
});



router.set('/api/register', async (req, res) =>
{
    if (req.method !== 'POST')
    {
        return reply(res, {
            status: false
        });
    }

    const {
        username,
        password
    } = await parse_body(req);

    const result =
        await register(username, password);

    reply(res, result);
});



createServer(async (req, res) =>
{
    const url = new URL(
        req.url,
        'http://' + config.server.ip
    );

    const handler =
        router.get(url.pathname)
        ||
        router.get(
            url.pathname.replace(
                '/index.html',
                '/'
            )
        );

    if (handler)
    {
        await handler(req, res);
    }
    else
    {
        res.writeHead(404);

        res.end('Not Found');
    }

}).listen(
    config.server.port,
    config.server.ip,

    () =>
    {
        console.log(
            `Server: http://${config.server.ip}:${config.server.port}`
        );
    }
);