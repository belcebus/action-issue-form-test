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
    let repoName = lineas[repoNamePos].trim()
    let repoDescription = lineas[repoDescriptionPos].trim()
    let adminTeam = lineas[adminTemaPos].trim()
    let adminTeamId = 0
    //let newRepoUrl = ""

 
    // inicializamos una lista con los errors encontrados
    let errors = []

    //Comprobamos que los campos obligatorios están informados
    if (adminTeam == noResponse || adminTeam == ""){
      errors.push("Admin team is mandatory, update the issue")
    }else{
      //Comprobamos que el team de administradores existe en la organización
      // y recuperamos su id
      console.log("Admin team: " + adminTeam)
      try {
        const { data: team } =  await github.rest.teams.getByName({
          org: context.repo.owner,
          team_slug: adminTeam
        })
        adminTeamId=team.id
        core.info("Admin team " + adminTeam + " exists in the organization, id: " + adminTeamId)
      }catch (error){
        errors.push("Admin team " + adminTeam + " does not exist in the organization, update the issue. Error: " + error)
        console.log(error)
      }
    }
    
    //Comprobamos que el nombre del repositorio cumple con los requisitos
    const regex = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}/i
    if (!regex.test(repoName) || !repoName.startsWith(prefix)) {
      errors.push("Repository name " + repoName + " does not meet the requirements, update the issue")
    }

    //Comprobamos que el repositorio no existe en la organización
    try {
      await github.rest.repos.get({
        owner: context.repo.owner,
        repo: repoName
      })
      errors.push("Repository " + repoName + " already exists in the organization, update the issue")
    }catch (error){
      core.info("Repository " + repoName + " does not exist in the organization")
    }

    //Procesamos la lista de errors de validación previa
    if (errors.length > 0){
      let body = ""
      for(error of errors){
        body += ":x: " + error + "\n"
      }
      //Crear un comentario en la issue avisando del error
      github.rest.issues.createComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: context.payload.issue.number,
        body: body
      })
      return
    }

    //Establecemos el valor a vacío en lugar de _No repoonse_ en los campos opcionales
    if (repoDescription == noResponse){
      repoDescription = ""
    }
      
    //Validaciones previas correctas, se puede crear el repositorio
    core.info("Issue number: " + context.payload.issue.number)
    core.info("Repository name: " + repoName)
    core.info("Repository description: " + repoDescription)
    core.info("Admin team: " + adminTeam)
    core.info("Admin team id: " + adminTeamId)
    
    core.info("Creating repository " + repoName + " in organization " + context.repo.owner)
    
    try {
      //crear el repositorio en la organización
      const {data: repo} = await github.rest.repos.createInOrg({
        org: context.repo.owner,
        name: repoName,
        description: repoDescription,
        private: true
      })

      //newRepoUrl = repo.html_url

      core.info("Repository " + repoName + " created in organization " + context.repo.owner + ". URL: " + repo.html_url)
      core.info("Adding admin team " + adminTeam + " to repository " + repoName + " in organization " + context.repo.owner)

      //Añadir el team de administradores al repositorio
      await github.rest.teams.addOrUpdateRepoPermissionsInOrg({
        org: context.repo.owner,
        team_slug: adminTeam,
        owner: context.repo.owner,
        repo: repoName,
        permission: "admin"
      })

      core.info("Admin team " + adminTeam + " added to repository " + repoName + " in organization " + context.repo.owner)

      //Añadir comentario en la issue indicando que el repositorio se ha creado correctamente
      await github.rest.issues.createComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: context.payload.issue.number,
        body: ":white_check_mark: Repository " + repoName + " created in organization " + context.repo.owner + ". URL: " + repo.html_url
      })

      //Cerrar la issue
      github.rest.issues.update({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: context.payload.issue.number,
        state: "closed",
        comment: "Repository " + repoName + " created in organization " + context.repo.owner
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
      //Mostrar el error completo en la consola y todas las trazas posibles
      console.log(error)
      return
    }

    core.info("Repository " + repoName + " created in organization " + context.repo.owner)
    core.info("retornando la url del repositorio creado: "+ repo.html_url)

    return repo.html_url
  }