import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { URL } from 'node:url';
import sqlite3 from 'sqlite3';

//-------------------------------------------------------------------------------
// CONFIG - carga de configuracion inicial.
//-------------------------------------------------------------------------------

function default_config()
{
    return {
        server: 
        {
            ip: '127.0.0.1',
            port: 3000,
            default_path: './default.html'
        },

        database: 
        {
            path: './db.sqlite3'
        }
    };
}

function load_config()
{
    let config = null;

    try
    {
        const data = readFileSync('./config.json', 'utf-8');

        config = JSON.parse(data);

        console.log('Configuración cargada.');
    }
    catch(error)
    {
        console.log('Usando configuración por defecto.');

        config = default_config();
    }

    return config;
}

let config = load_config();

//-------------------------------------------------------------------------------
// DATABASE
//-------------------------------------------------------------------------------

function connect_db(path)
{
    const dbPath = resolve(path);

    const db = new sqlite3.Database(dbPath, (err) =>
    {
        if (err)
        {
            throw new Error(`Error DB: ${err.message}`);
        }
    });

    return db;
}

const db = connect_db(config.database.path);

//-------------------------------------------------------------------------------
// LOGICA NEGOCIO
//-------------------------------------------------------------------------------

function login(username, password)
{
    return new Promise((resolve) =>
    {
        const sql = `
            SELECT id, username
            FROM user
            WHERE username = ?
            AND password = ?
        `;

        db.get(sql, [username, password], (err, row) =>
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
                    description: 'INVALID_USER_PASS'
                });
            }
        });
    });
}

function register(username, password)
{
    return new Promise((resolve) =>
    {
        const sql = `
            INSERT INTO user (username, password)
            VALUES (?, ?)
        `;

        db.run(sql, [username, password], function(err)
        {
            if (err)
            {
                resolve({
                    status: false,
                    description: err.message
                });
            }
            else
            {
                resolve({
                    status: true,
                    result: username
                });
            }
        });
    });
}

function get_permissions(username)
{
    return new Promise((resolve) =>
    {
        const sql = `
            SELECT DISTINCT e.path
            FROM user u
            JOIN members m ON u.id = m.id_user
            JOIN "group" g ON m.id_group = g.id
            JOIN access a ON g.id = a.id_group
            JOIN endpoint e ON a.id_endpoint = e.id
            WHERE u.username = ?
        `;

        db.all(sql, [username], (err, rows) =>
        {
            resolve({
                status: true,
                endpoints: rows ? rows.map(r => r.path) : []
            });
        });
    });
}

function addActionGroup(id_group, id_endpoint)
{
    return new Promise((resolve) =>
    {
        const sql = `
            INSERT INTO access (id_group, id_endpoint)
            VALUES (?, ?)
        `;

        db.run(sql, [id_group, id_endpoint], function(err)
        {
            if (err)
            {
                resolve({
                    status: false,
                    description: err.message
                });
            }
            else
            {
                resolve({
                    status: true
                });
            }
        });
    });
}

function removeActionGroup(id_group, id_endpoint)
{
    return new Promise((resolve) =>
    {
        const sql = `
            DELETE FROM access
            WHERE id_group = ?
            AND id_endpoint = ?
        `;

        db.run(sql, [id_group, id_endpoint], function(err)
        {
            if (err)
            {
                resolve({
                    status: false,
                    description: err.message
                });
            }
            else
            {
                resolve({
                    status: true
                });
            }
        });
    });
}

//-------------------------------------------------------------------------------
// HANDLERS
//-------------------------------------------------------------------------------

function default_handler(request, response)
{
    try
    {
        const html = readFileSync(config.server.default_path, 'utf-8');

        response.writeHead(200, { 'Content-Type': 'text/html' });

        response.end(html);
    }
    catch(error)
    {
        response.writeHead(500);

        response.end('Error cargando HTML');
    }
}

async function login_handler(request, response)
{
    if (request.method !== 'POST')
    {
        response.writeHead(405);

        response.end('Método no permitido');

        return;
    }

    let body = '';

    request.on('data', chunk =>
    {
        body += chunk.toString();
    });

    request.on('end', async () =>
    {
        const input = Object.fromEntries(new URLSearchParams(body));

        const output = await login(input.username, input.password);

        if (output.status)
        {
            const permissions = await get_permissions(input.username);

            output.endpoints = permissions.endpoints;
        }

        response.writeHead(200, { 'Content-Type': 'application/json' });

        response.end(JSON.stringify(output));
    });
}

function register_handler(request, response)
{
    if (request.method !== 'POST')
    {
        response.writeHead(405);

        response.end('Método no permitido');

        return;
    }

    let body = '';

    request.on('data', chunk =>
    {
        body += chunk.toString();
    });

    request.on('end', async () =>
    {
        const input = Object.fromEntries(new URLSearchParams(body));

        const output = await register(input.username, input.password);

        response.writeHead(200, { 'Content-Type': 'application/json' });

        response.end(JSON.stringify(output));
    });
}

//-------------------------------------------------------------------------------
// ROUTER
//-------------------------------------------------------------------------------

let router = new Map();

router.set('/', default_handler);
router.set('/api/login', login_handler);
router.set('/api/register', register_handler);

//-------------------------------------------------------------------------------
// DISPATCHER
//-------------------------------------------------------------------------------

async function request_dispatcher(request, response)
{
    const url = new URL(request.url, 'http://' + config.server.ip);

    const path = url.pathname;

    const handler = router.get(path);

    if (handler)
    {
        return await handler(request, response);
    }
    else
    {
        response.writeHead(404);

        response.end('Ruta no encontrada');
    }
}

//-------------------------------------------------------------------------------
// START SERVER
//-------------------------------------------------------------------------------

function start()
{
    console.log(`Servidor ejecutándose en http://${config.server.ip}:${config.server.port}`);
}

let server = createServer(request_dispatcher);

server.listen(config.server.port, config.server.ip, start);