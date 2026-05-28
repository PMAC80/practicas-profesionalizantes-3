import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';
import { URL } from 'node:url';

//-------------------------------------------------------------------------------
// trabajo con el config.json
//-------------------------------------------------------------------------------

function default_config() 
{
    const config = 
    {
        server: 
            {
            ip: '127.0.0.1',
            port: 3000,
            default_path: './default.html'
            },
        database: 
            {
            path: './db.sqlite'
            }
    };

    return config;
}

function load_config() 
{
    let config = null;
    try 
      {
          const data = readFileSync('./config.json', 'utf-8');
          config = JSON.parse(data);
          console.log("Configuración cargada correctamente.");
      } 
    catch (error) 
      {
          console.error("Error cargando config.json. Usando valores por defecto.");
          config = default_config();
      }
    return config;
}

let config = load_config();

//-------------------------------------------------------------------------------
// trabajo con base de datos
//-------------------------------------------------------------------------------

function connect_db(path) 
{
    const dbPath = resolve(path);
    try 
    {
        const db = new DatabaseSync(dbPath);
        return db;
    } 
    catch (err) 
    {
        throw new Error("Error al conectar a la base de datos: " + err.message);
    }
}

const db = connect_db(config.database.path);

function createUser(db, username, password) 
{
    const sql = "INSERT INTO user (username, password) VALUES (?, ?) RETURNING id";
    try 
    {
        const stmt = db.prepare(sql);
        const row = stmt.get(username, password);
        const result = 
        {
            id: row.id,
            username: username,
            password: password
        };
        
        return result;
    } 
    catch (err) 
    {
        throw err;
    }
}


//-------------------------------------------------------------------------------
// logica de negocio
//-------------------------------------------------------------------------------

//------------------- ABM de grupos -------------------
function createGroup(db, name) {
    const sql = "INSERT INTO `group` (name) VALUES (?) RETURNING id";
    try {
        const stmt = db.prepare(sql);
        const row = stmt.get(name);
        return { status: true, id: row.id, name };
    } catch (err) {
        return { status: false, description: err.message };
    }
}

function deleteGroup(db, id) {
    const sql = "DELETE FROM `group` WHERE id = ?";
    try {
        const stmt = db.prepare(sql);
        stmt.run(id);
        return { status: true };
    } catch (err) {
        return { status: false, description: err.message };
    }
}

function updateGroup(db, id, name) {
    const sql = "UPDATE `group` SET name = ? WHERE id = ?";
    try {
        const stmt = db.prepare(sql);
        stmt.run(name, id);
        return { status: true };
    } catch (err) {
        return { status: false, description: err.message };
    }
}

//------------------- Eliminación de usuario -------------------
function deleteUser(db, id) {
    const sql = "DELETE FROM user WHERE id = ?";
    try {
        const stmt = db.prepare(sql);
        stmt.run(id);
        return { status: true };
    } catch (err) {
        return { status: false, description: err.message };
    }
}
//------------------- Handlers ABM grupos y eliminación usuario -------------------
function group_create_handler(request, response) {
    if (request.method === 'POST') {
        let body = '';
        request.on('data', chunk => { body += chunk.toString(); });
        request.on('end', () => {
            const inputParams = new URLSearchParams(body);
            const input = Object.fromEntries(inputParams);
            const result = createGroup(db, input.name);
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify(result));
        });
    } else {
        response.writeHead(405);
        response.end('Método no permitido. Utilice POST.');
    }
}

function group_delete_handler(request, response) {
    if (request.method === 'POST') {
        let body = '';
        request.on('data', chunk => { body += chunk.toString(); });
        request.on('end', () => {
            const inputParams = new URLSearchParams(body);
            const input = Object.fromEntries(inputParams);
            const result = deleteGroup(db, input.id);
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify(result));
        });
    } else {
        response.writeHead(405);
        response.end('Método no permitido. Utilice POST.');
    }
}

function group_update_handler(request, response) {
    if (request.method === 'POST') {
        let body = '';
        request.on('data', chunk => { body += chunk.toString(); });
        request.on('end', () => {
            const inputParams = new URLSearchParams(body);
            const input = Object.fromEntries(inputParams);
            const result = updateGroup(db, input.id, input.name);
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify(result));
        });
    } else {
        response.writeHead(405);
        response.end('Método no permitido. Utilice POST.');
    }
}

function user_delete_handler(request, response) {
    if (request.method === 'POST') {
        let body = '';
        request.on('data', chunk => { body += chunk.toString(); });
        request.on('end', () => {
            const inputParams = new URLSearchParams(body);
            const input = Object.fromEntries(inputParams);
            const result = deleteUser(db, input.id);
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify(result));
        });
    } else {
        response.writeHead(405);
        response.end('Método no permitido. Utilice POST.');
    }
}

function show_message_handler(request, response)
{
    console.log("Petición recibida: Mostrando mensaje en el servidor!");
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ message: "Mensaje procesado" }));
}

function login( input )
{
	const userdata =
	{
		username: 'admin',
		password: '1234'
	};

	let output =
	{
		status: false,
		result: null,
		description: 'INVALID_USER_PASS'
	};

	
	if ( input.username === userdata.username && input.password === userdata.password )
    {
      output.status = true;
      output.result = input.username;
      output.description = null;
    }

	return output;
}


async function login_handler(request, response)
{
    const url = new URL(request.url, 'http://' + config.server.ip);
    const input = Object.fromEntries(url.searchParams);

    console.log(input);

    const output = login(input);

    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(output));
}

function default_handler(request, response)
{
	try 
	{
        const html = readFileSync(config.server.default_path, 'utf-8');
        response.writeHead(200, { 'Content-Type': 'text/html' });
        response.end(html);
    } 
  catch (error) 
    {
        response.writeHead(500);
        response.end('Error interno: No se pudo cargar la vista principal.');
    }
}

function register_handler(request, response) 
{
    if (request.method === 'POST') {
        let body = '';
        request.on('data', chunk => {
            body += chunk.toString();
        });
        request.on('end', () => {
            const inputParams = new URLSearchParams(body);
            const input = Object.fromEntries(inputParams);
            try {
                const user = createUser(db, input.username, input.password);
                response.writeHead(200, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ status: true, ...user, description: 'Usuario registrado con éxito' }));
            } catch (err) {
                response.writeHead(200, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ status: false, description: err.message }));
            }
        });
    } else {
        response.writeHead(405);
        response.end('Método no permitido. Utilice POST.');
    }
}


let router = new Map();

router.set('/group/create', group_create_handler);
router.set('/group/delete', group_delete_handler);
router.set('/group/update', group_update_handler);
router.set('/user/delete', user_delete_handler);


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
            response.end('Método no encontrado');
        }
}
//-------------------------------------------------------------------------------
//          iniciar el servidor
//-------------------------------------------------------------------------------

function start()
{
	console.log(`Servidor ejecutándose en http://${config.server.ip}:${config.server.port}`);
}

let server = createServer(request_dispatcher);

server.listen(config.server.port, config.server.ip, start);