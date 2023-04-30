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
      //Comprobamos que el team de administradores existe en la organización
      try {
        await github.rest.teams.getByName({
          org: context.repo.owner,
          team_slug: adminTeam
        })
      }catch (error){
        core.setFailed("Error getting team " + adminTeam + " from organization " + context.repo.owner)
        github.rest.issues.createComment({
          owner: context.repo.owner,
          repo: context.repo.repo,
          issue_number: context.payload.issue.number,
          body: ":x: Admin team " + adminTeam + " does not exist in the organization, update the issue. Error: " + error
        }) 
        return
      } 
    }
    //Comprobamos que el nombre del repositorio cumple con los requisitos
    const regex = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}/i
    if (regex.test(repoName) && repoName.startsWith(prefix)) {
      core.info('El nombre del repositorio solicitado comienza con el prefijo y tiene un formato válido')
      //Validaciones previas correctas, se puede crear el repositorio
      core.info("Issue number: " + context.payload.issue.number)
      core.info("Repository name: " + repoName)
      core.info("Repository description: " + repoDescription)
      core.info("Admin team: " + adminTeam)
      //TODO: crear el repositorio en la organización
      try {
        await github.rest.repos.createInOrg({
          org: context.repo.owner,
          name: repoName,
          description: repoDescription,
          private: true,
          team_id: adminTeam
        })
      }
      catch (error){
        core.setFailed("Error creating repository " + repoName + " in organization " + context.repo.owner + ". Error: " + error)
        github.rest.issues.createComment({
          owner: context.repo.owner,
          repo: context.repo.repo,
          issue_number: context.payload.issue.number,
          body: ":x: Error creating repository " + repoName + " in organization " + context.repo.owner + ". Error: " + error
        }) 
        return
      }
    } else {
      core.setFailed(`El nombre del repositorio ${repoName} no cumple con los requisitos`)
      github.rest.issues.createComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: context.payload.issue.number,
        body: ":x: El nombre del repositorio " + repoName + " no cumple con los requisitos"
      })
      return
    }

    //TODO: retornar la url del repositorio creado y cerrar la issue
    return context.payload.issue 
  }