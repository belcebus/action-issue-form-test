
module.exports = ({github, context, core}) => {

    console.log(context.payload.issue.body);
    console.log("******************");
    let noResponse = "_No response_";

    let lineas = context.payload.issue.body.split("\n");
    let repoName = lineas[2];
    let repoDescription = lineas[6]
    let adminTeam = lineas[10]

    if (repoDescription == noResponse){
    repoDescription = "";
    }
    if (adminTeam == noResponse){
    core.setFailed("Admin team es mandatory")
    return
    }

    console.log("Repository name: " + repoName)
    core.debug("Repository description: " + repoDescription)
    core.debug("Admin team: " + adminTeam)

    const regex = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}/i;
    if (regex.test(repoName) && repoName.startsWith("gln-")) {
    core.info('El nombre del repositorio solicitado comienza con el prefijo y tiene un formato válido');

    } else {
    core.setFailed(`El nombre del repositorio ${repoName} no cumple con los requisitos`);
    }
    return context.payload.issue
  }

/*

*/