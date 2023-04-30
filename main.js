/**
 * Script que se ejecuta cuando se crea una issue en el repositorio
 * analiza el contenido de la issue y crea un repositorio en la organización
 * con el nombre y descripción indicados en la issue.
 * 
 */

module.exports = async ({github, context, core}) => {

    core.debug(context.payload.issue.body)
    
    const noResponse = "_No response_"
    const prefix = "gln-"
    const repoNamePos = 2
    const repoDescriptionPos = 6
    const adminTemaPos = 10
   
    let lineas = context.payload.issue.body.split("\n")
    let repoName = lineas[repoNamePos]
    let repoDescription = lineas[repoDescriptionPos]
    let adminTeam = lineas[adminTemaPos]

    if (repoDescription == noResponse){
      //Establecemos el valor a vacío en lugar de _No repoonse_
      repoDescription = ""
    }
    if (adminTeam == noResponse){
      //El team de administradores del repositorio es obligatorio
      core.setFailed("Admin team es mandatory")
      
      //Crear un comentario en la issue avisando del error
      github.rest.issues.createComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: context.payload.issue.number,
        body: ":x: Admin team is mandatory, update the issue"
      })
      return
    }else{
      //verificamos que el team existe dentro de la organización
      const team = await github.rest.teams.getByName({
        org: context.repo.owner,
        team_slug: adminTeam
      })
      if (team.status == 404){
        github.rest.issues.createComment({
          owner: context.repo.owner,
          repo: context.repo.repo,
          issue_number: context.payload.issue.number,
          body: ":x: Admin team " + adminTeam + " does not exist in the organization, update the issue"
        })  
      } 
    }

    core.info("Repository name: " + repoName)
    core.info("Repository description: " + repoDescription)
    core.info("Admin team: " + adminTeam)

    const regex = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}/i
    if (regex.test(repoName) && repoName.startsWith(prefix)) {
      core.info('El nombre del repositorio solicitado comienza con el prefijo y tiene un formato válido')
      //TODO: crear el repositorio para retornar la url
    } else {
      core.setFailed(`El nombre del repositorio ${repoName} no cumple con los requisitos`)
      return
    }
    //TODO: retornar la url del repositorio creado y cerrar la issue
    return context.payload.issue 
  }