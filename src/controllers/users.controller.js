const mongoose = require("mongoose");
const UsersRepository = require("../dao/repository/users.repository");
const Users = require("../dao/Mongo/models/users.modelo.js")
const SendMail = require("../config/nodemailer-jwt.config.js")
const bcrypt = require("bcrypt");
const entornoConfig = require("../config/entorno.config.js");
const jwt = require("jsonwebtoken");

const CustomError = require("../utils/customError.js");
const tiposDeError = require("../utils/tiposDeError.js");

const getUsersDTO = require("../dto/dtoGetUsers.js")

const createUser = async (userData) => {
  try {
    const { password } = userData;
    const hashedPassword = await bcrypt.hash(password, 10);
    userData.password = hashedPassword;
    const user = await UsersRepository.createUser(userData);
    return user;
  } catch (error) {
    throw new CustomError(
      "ERROR_CREAR_USUARIO",
      "Error al crear usuario",
      tiposDeError.ERROR_INTERNO_SERVIDOR,
      error.message
    );
  }
};

const getUserByEmail = async (email) => {
  try {
    const user = await UsersRepository.getUserByEmail(email);
    return user;
  } catch (error) {
    throw new CustomError(
      "ERROR_OBTENER_USUARIO",
      "Error al obtener usuario por correo electrónico",
      tiposDeError.ERROR_INTERNO_SERVIDOR,
      error.message
    );
  }
};


const getUserById = async (req, res, next) => {
  try {
    let id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id))
      throw new CustomError(
        "ERROR_DATOS",
        "ID inválido",
        tiposDeError.ERROR_DATOS,
        "El id proporcionado no es válido"
      );
    let usuarioDB = await UsersRepository.getUserById(id);
    if (!usuarioDB)
      throw new CustomError(
        "USUARIO_NO_ENCONTRADO",
        "Usuario no encontrado",
        tiposDeError.USUARIO_NO_ENCONTRADO,
        `El Usuario con ID ${id} no existe.`
      );

    res.locals.usuarioDB = usuarioDB;
    next();
  } catch (error) {
    res.status(tiposDeError.ERROR_INTERNO_SERVIDOR).json({
      mensaje: "Error interno del servidor",
    });
  }
};

const getUsers = async (req, res) => {
  try {
    const users = await UsersRepository.getUsers();
    res.status(200).json(users);
    return(users)
  } catch (error) {
    throw new CustomError(
      "ERROR_OBTENER_USUARIOS",
      "Error al obtener usuarios",
      tiposDeError.ERROR_INTERNO_SERVIDOR,
      error.message
    );
  }
};

const DTOgetUsers = async () => {
  try {
    const users = await UsersRepository.getUsers();
    const usersDTO = getUsersDTO(users);
    return usersDTO;
  } catch (error) {
    throw new CustomError(
      "ERROR_OBTENER_USUARIOS",
      "Error al obtener usuarios",
      tiposDeError.ERROR_INTERNO_SERVIDOR,
      error.message
    );
  }
};

const updateUser = async (req, res) => {
  try {
    const id = req.params.id;
    const user = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new CustomError(
        "ERROR_DATOS",
        "ID inválido",
        tiposDeError.ERROR_DATOS,
        "El ID proporcionado no es válido."
      );
    }

    const userDB = await UsersRepository.getUserById(id);

    if (!userDB) {
      throw new CustomError(
        "USUARIO_NO_ENCONTRADO",
        "Usuario no encontrado",
        tiposDeError.USUARIO_NO_ENCONTRADO,
        `El usuario con ID ${id} no existe.`
      );
    }

    if (
      !user.first_name ||
      !user.last_name ||
      !user.email ||
      !user.age ||
      !user.cart ||
      !user.role
    ) {
      throw new CustomError(
        "ERROR_DATOS",
        "Faltan datos",
        tiposDeError.ERROR_DATOS,
        "Faltan datos obligatorios para editar el usuario."
      );
    }

    if (user.password) {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      user.password = hashedPassword;
    }

    const userEditado = await UsersRepository.updateUser(id, user);

    res.status(200).json({ userEditado });
  } catch (error) {
    res.status(error.codigo || tiposDeError.ERROR_INTERNO_SERVIDOR).json({
      error: "Error inesperado",
      detalle: error.message,
    });
  }
};

const deleteUser = async (req, res) => {
  try {
    const id = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new CustomError(
        "ERROR_DATOS",
        "ID inválido",
        tiposDeError.ERROR_DATOS,
        "El ID proporcionado no es válido."
      );
    }

    const user = await UsersRepository.getUserById(id);

    if (!user) {
      throw new CustomError(
        "USUARIO_NO_ENCONTRADO",
        "Usuario no encontrado",
        tiposDeError.PRODUCTO_NO_ENCONTRADO,
        `El usuario con ID ${id} no existe.`
      );
    }
    const userEmail = user.email;

    const resultado = await UsersRepository.deleteUser(id);
    await SendMail.sendUserDeletedEmail(
      userEmail,
      "Tu cuenta ha sido eliminada por decisión administrativa.",
      `Estimado/a usuario/a: Lamentablemente tu cuenta ha sido eliminada por decisión administrativa. Gracias por usar nuestro servicio.`
    );

    res
      .status(200)
      .json({ mensaje: "El Usuario fue correctamente eliminado", resultado });
  } catch (error) {
    res.status(404).json({
      mensaje: "Error, el usuario solicitado no pudo ser eliminado",
    });
  }
};

const secret = entornoConfig.SECRET;

const updatePassword = async (req, res) => {
  try {
    const token = req.params.token;
    const newPassword = req.body.newPassword;
    let errorMessage = null;

    const decodedToken = jwt.verify(token, secret);

    if (decodedToken.exp < Date.now() / 1000) {
      errorMessage = "Error al actualizar la contraseña. - Token expirado";
      return res.redirect("/forgotPassword");
    }
    const user = await UsersRepository.getUserByEmail(decodedToken.email);

    const isSamePassword = await bcrypt.compare(newPassword, user.password);

    if (isSamePassword) {
      throw new CustomError(
        "CONTRASENA_ANTIGUA",
        "Contraseña igual a la actual",
        tiposDeError.ERROR_NO_AUTORIZADO,
        "La nueva contraseña no puede ser igual a la contraseña actual."
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    user.reset_password_token = null;
    user.reset_password_expires = null;

    await user.save();

    res.status(200).send("Contraseña actualizada correctamente.");
  } catch (error) {
    if (error.name === "TOKEN_EXPIRADO") {
      res
        .status(400)
        .send("Error al actualizar la contraseña. - Token expirado");
    } else if (error.name === "CONTRASENA_ANTIGUA") {
      res
        .status(400)
        .send("La nueva contraseña no puede ser igual a la contraseña actual.");
    } else {
      console.error(error);
      res.status(400).send("Error al actualizar la contraseña.");
    }
  }
};

const userRoleVista = async (req, res, render) => {
  try {
    const userId = req.params.id;
    const { newRole } = req.body;

    if (!["user", "premium"].includes(newRole)) {
      throw new Error("Rol no válido");
    }
    const usuario = await UsersRepository.getUserById(userId);

    if (!usuario) {
      throw new Error("Usuario no encontrado");
    }

    usuario.role = newRole;

    await usuario.save();

    render(res, {
      title: "Cambio de Rol Exitoso",
      success: true,
      message: `Se ha cambiado el rol del usuario ${usuario.nombre} a ${newRole}`,
    });
  } catch (error) {
    render(res, {
      title: "Error al Cambiar el Rol",
      success: false,
      error: error.message,
    });
  }
};

const getUserRoleById = async (req, res) => {
  try {
    const userId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new CustomError(
        "ERROR_DATOS",
        "ID inválido",
        tiposDeError.ERROR_DATOS,
        "El ID proporcionado no es válido."
      );
    }

    const usuario = await UsersRepository.getUserById(userId);

    if (!usuario) {
      throw new CustomError(
        "USUARIO_NO_ENCONTRADO",
        "Usuario no encontrado",
        tiposDeError.USUARIO_NO_ENCONTRADO,
        `El usuario con ID ${userId} no existe.`
      );
    }

    const userRole = usuario.role;

    res.status(200).json({ userId, userRole });
  } catch (error) {
    res.status(error.codigo || tiposDeError.ERROR_INTERNO_SERVIDOR).json({
      error: "Error inesperado",
      detalle: error.message,
    });
  }
};

const changeUserRole = async (req, res) => {
  try {
    const userId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        error: "ID inválido",
        detalle: "El ID proporcionado no es válido.",
      });
    }

    const usuario = await UsersRepository.getUserById(userId);

    if (!usuario) {
      return res.status(404).json({
        error: "Usuario no encontrado",
        detalle: `El usuario con ID ${userId} no existe.`,
      });
    }

    if (usuario.role === "user") {
      const hasDni = usuario.documents.some((doc) =>
        doc.reference.includes("DNI")
      );
      const hasCuenta = usuario.documents.some((doc) =>
        doc.reference.includes("CUENTA")
      );
      const hasDomicilio = usuario.documents.some((doc) =>
        doc.reference.includes("DOMICILIO")
      );

      if (!hasDni || !hasCuenta || !hasDomicilio) {
        const missingDocuments = [];
        if (!hasDni) missingDocuments.push("DNI");
        if (!hasCuenta) missingDocuments.push("CUENTA");
        if (!hasDomicilio) missingDocuments.push("DOMICILIO");
        
        return res.status(400).json({
        error: "El usuario no ha terminado de procesar su documentación",
       missingDocuments,
       });  
      }
    }
    usuario.role = usuario.role === "user" ? "premium" : "user";
    await usuario.save();

    res.status(200).json({
      userId,
      newRole: usuario.role,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Error inesperado",
      detalle: error.message,
    });
  }
};

const changeUserRoleEnVista = async (req, res) => {
  try {
    const userId = req.params.id;
    const { newRole } = req.body;

    if (!["user", "premium"].includes(newRole)) {
      throw new Error("Rol no válido");
    }

    const usuario = await UsersRepository.getUserById(userId);
    if (!usuario) {
      throw new Error("Usuario no encontrado");
    }

    if (newRole === "premium") {
      const hasDni = usuario.documents.some((doc) =>
        doc.reference.includes("DNI")
      );
      const hasCuenta = usuario.documents.some((doc) =>
        doc.reference.includes("CUENTA")
      );
      const hasDomicilio = usuario.documents.some((doc) =>
        doc.reference.includes("DOMICILIO")
      );

      if (!hasDni || !hasCuenta || !hasDomicilio) {     
        const missingDocuments = [];
        if (!hasDni) missingDocuments.push("DNI");
        if (!hasCuenta) missingDocuments.push("CUENTA");
        if (!hasDomicilio) missingDocuments.push("DOMICILIO");

        return res.render("cambiaRole", {
          title: "Error al Cambiar el Rol",
          success: false,
          error: "El usuario no ha terminado de procesar su documentación",
          missingDocuments,
        });
      }
    }
    usuario.role = newRole;

    await usuario.save();

    req.session.usuario.role = newRole;

    res.redirect(`/`);
  } catch (error) {
    res.render("cambiaRole", {
      title: "Error al Cambiar el Rol",
      success: false,
      error: error.message,
    });
  }
};

const updateLastConnection = async (email) => {
  try {
    return await UsersRepository.updateLastConnection(email);
  } catch (error) { 
    throw new Error(`Error al actualizar last_connection: ${error.message}`);
  }
};

const updateLastConnectionGithub = async (email) => {
  try {
    return await UsersRepository.updateLastConnectionGithub(email);
  } catch (error) {
    throw new Error(`Error al actualizar last_connection: ${error.message}`);
  }
};

const handleDocumentUpload = async (userId, file) => {
  try {
    const user = await UsersRepository.getUserById(userId);
    if (!user) {
      throw new Error("Usuario no encontrado");
    }
    const newDocument = {
      name: file.originalname,
      reference: file.path,
    };
    user.documents.push(newDocument);
    await user.save();
    const message = `El documento "${newDocument.name}" se ha subido correctamente.`;
    return { message };
  } catch (error) {
    throw new Error(
      `Error al manejar la subida de documentos: ${error.message}`
    );
  }
};

const getUserByGithubEmail = async (githubEmail) => {
  try {
    const user = await UsersRepository.getUserByGithubEmail(githubEmail);
    return user;
  } catch (error) {
    throw new CustomError(
      "ERROR_OBTENER_USUARIO_GITHUB",
      "Error al obtener usuario de GitHub por correo electrónico",
      tiposDeError.ERROR_INTERNO_SERVIDOR,
      error.message
    );
  }
};


const createUserFromGithub = async (userData) => {
  try {
    const user = await UsersRepository.createUserGithub(userData);
    return user;
  } catch (error) {
    throw new CustomError(
      "ERROR_CREAR_USUARIO_GITHUB",
      "Error al crear usuario desde GitHub",
      tiposDeError.ERROR_INTERNO_SERVIDOR,
      error.message
    );
  }
};

const getUserByIdGithub = async (userId) => {
  try {
    const user = await UsersRepository.getUserByIdGithub(userId);
    return user;
  } catch (error) {
    throw new CustomError(
      "ERROR_OBTENER_USUARIO_GITHUB_POR_ID",
      "Error al obtener usuario de GitHub por ID",
      tiposDeError.ERROR_INTERNO_SERVIDOR,
      error.message
    );
  }
};


const deleteInactiveUsers = async () => {
  try {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const deletedUsers = await Users.find({
      last_connection: { $lt: twoDaysAgo },
    });
    const userEmails = deletedUsers.map((user) => user.email);
    const result = await Users.deleteMany({
      last_connection: { $lt: twoDaysAgo },
    });


    for (const userEmail of userEmails) {
      await SendMail.sendInactiveUserEmail(
        userEmail,
        "Tu cuenta ha sido eliminada por inactividad.",
        `Estimado/a usuario/a: Lamentablemente tu cuenta ha sido eliminada por inactividad. Gracias por usar nuestro servicio.`
      );
    }
  } catch (error) {
    console.error("Error al eliminar usuarios inactivos:", error.message);
  }
};


module.exports = {
  createUser,
  getUserByEmail,
  getUserById,
  getUsers,
  updateUser,
  deleteUser,
  updatePassword,
  userRoleVista,
  getUserRoleById,
  changeUserRole,
  changeUserRoleEnVista,
  updateLastConnection,
  updateLastConnectionGithub,
  handleDocumentUpload,
  getUserByGithubEmail,
  createUserFromGithub,
  getUserByIdGithub,
  DTOgetUsers,
  deleteInactiveUsers,
};
