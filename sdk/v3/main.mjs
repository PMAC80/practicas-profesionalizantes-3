import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';
import { URL } from 'node:url';
import crypto from 'node:crypto';

function default_config() 
{
    const config = 
    {
        server: 
        {
            ip: '127.0.0.1',
            port: 3000,
            default_path: './index.html'
        },
        database: 
        {
            path: './database.db'
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

const config = load_config();

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


let userSessions = new Map();  //clave-valor  -> clave: id_user,  valor: sessionObj

class UserSession
{
    constructor()
    {
       this.status = 'disabled';
    }

}

function hashPassword(password)
{
    return crypto
        .createHash('sha256')
        .update(password)
        .digest('hex');
}


function authenticate( username, password )
{
    
    const sql = "SELECT count(*) as total FROM `user` WHERE username=? AND password=?";

    try 
    {
        const passwordHash = hashPassword(password);

        const stmt = db.prepare(sql);
        const row = stmt.get(username, passwordHash);            
        return (row.total === 1);
    } 
    catch (err) 
    {
        throw err;
    }
}


function authorize( username, endpointPath )
{
    const sql = `
        SELECT count(*) as total
        FROM access a
        JOIN members m ON a.id_group = m.id_group
        JOIN user u ON m.id_user = u.id
        JOIN endpoint e ON a.id_endpoint = e.id
        WHERE u.username = ? 
          AND e.path = ?
    `;

    try {
        const stmt = db.prepare(sql);
        // Pasamos los parámetros en el orden de los signos de interrogación
        const row = stmt.get(username, endpointPath);
        console.log(row);
        // Si el conteo es mayor a 0, tiene permiso
        return row.total > 0;
    } catch (err) {
        console.error("Error consultando permisos:", err);
        throw err;
    }
}


function login( username, password )
{
    
    let isAuthenticated = authenticate(username, password);

    if ( isAuthenticated )
    {
    let havePreviousSession = userSessions.get(username);

    if ( havePreviousSession == null )
        {
            let newSession = new UserSession();
            newSession.status = 'enabled';

            userSessions.set(username, newSession);

            return newSession;
        }
    else
        {
            if ( havePreviousSession.status == 'disabled' )
            {
                havePreviousSession.status = 'enabled';
            }

            return havePreviousSession;
        }    }
        else
        {
            return null;
        }

    //El retorno de esta función está representando si se devuelve o no un objeto de sesión.
}

function logout(username, password)
{
    let isAuthenticated = authenticate(username, password);

    if ( isAuthenticated )
    {
        let currentSession = userSessions.get(username);
        currentSession.status = 'disabled';
    }
}

// Lógica de negocio
async function createUser(db, username, password) 
{
    const sql = "INSERT INTO user (username, password) VALUES (?, ?) RETURNING id";

    try 
    {
        const passwordHash = hashPassword(password);

        const stmt = db.prepare(sql);
        const row = stmt.get(username, passwordHash);
        const result =
        {
            id: row.id,
            username: username
        };        
        return result;
    } 
    catch (err) 
    {
        throw err;
    }
}

const db = connect_db(config.database.path);
//const output = await createUser(db, 'test', '123456789');



// Manejadores
async function login_handler(request, response)
{
    const url = new URL(request.url, 'http://' + config.server.ip);
    
    if ( request.method == "POST" )
    {
        let body = '';
        request.on('data', chunk => {
            body += chunk.toString();
        });

        request.on('end', async () => 
        {
            try 
            {
                // 3. Convertimos el string a objeto (asumiendo que envían JSON)
                const input = JSON.parse(body);

                // 4. Procesamos el login
                const output = login(input.username, input.password); //El resultado es nulo o un objeto de sesión

                response.writeHead(200, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(output));
            } 
            catch (err) 
            {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'Formato JSON inválido' }));
            }
        });
    }
    else
    {
        response.writeHead(405, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: 'Método no permitido. Usa POST.' }));
        return;
    }
  
    
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

async function register_handler(request, response)
{
    //Caso GET
    const url = new URL(request.url, 'http://' + config.server.ip);
    const input = Object.fromEntries(url.searchParams);

    try 
    {
    const output = await createUser(
        db,
        input.username,
        input.password
    );
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify(output));
    }
    catch (err)
    {
        response.writeHead(500);
        response.end(JSON.stringify({ error: err.message }));
    }
}

function show_message_handler(request, response)
{
    console.log("Petición recibida: Mostrando mensaje en el servidor!");
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ message: "Mensaje procesado" }));
}

function log_handler(request, response)
{
    const permitido = authorize("admin", "log");

    if (permitido)
    {
        console.log("LOG permitido");
        response.end("LOG permitido");
    }
    else
    {
        console.log("LOG denegado");
        response.end("LOG denegado");
    }
}
function sayHello_handler(request, response)
{
    const permitido = authorize("admin", "sayHello");

    if (permitido)
    {
        console.log("SAYHELLO permitido");
        response.end("SAYHELLO permitido");
    }
    else
    {
        console.log("SAYHELLO denegado");
        response.end("SAYHELLO denegado");
    }
}

function sayBye_handler(request, response)
{
    const permitido = authorize("admin", "sayBye");

    if (permitido)
    {
        console.log("SAYBYE permitido");
        response.end("SAYBYE permitido");
    }
    else
    {
        console.log("SAYBYE denegado");
        response.end("SAYBYE denegado");
    }
}
function print_handler(request, response)
{
    const permitido = authorize("admin", "print");

    if (permitido)
    {
        console.log("PRINT permitido");
        response.end("PRINT permitido");
    }
    else
    {
        console.log("PRINT denegado");
        response.end("PRINT denegado");
    }
}
function help_handler(request, response)
{
    const permitido = authorize("admin", "help");

    if (permitido)
    {
        console.log("HELP permitido");
        response.end("HELP permitido");
    }
    else
    {
        console.log("HELP denegado");
        response.end("HELP denegado");
    }
}


// Ruteo
let router = new Map();
router.set('/', default_handler);
router.set('/login', login_handler);

router.set('/register', register_handler);
router.set('/showMessage', show_message_handler);
router.set('/print', print_handler);
router.set('/log', log_handler);
router.set('/help', help_handler);
router.set('/sayHello', sayHello_handler);
router.set('/sayBye', sayBye_handler);

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

function start()
{
    console.log('Servidor ejecutándose en http://' + config.server.ip + ':' + config.server.port);
}

let server = createServer(request_dispatcher);
server.listen(config.server.port, config.server.ip, start);