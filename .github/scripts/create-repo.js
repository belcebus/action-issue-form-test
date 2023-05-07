/**
 * Script that runs when an issue is created in the repository
 * parses the content of the issue and creates a repository in the organization
 * with the name and description given in the issue.
 * 
 * Assigns the team of administrators specified in the issue as administrator.
 * 
 * If the repository is successfully created, the issue is closed.
 * 
 * If an error occurs, a comment is added to the issue indicating the error.
 * 
 */

module.exports = async ({ github, context, core }) => {

  const noResponse = "_No response_"                      // value to be used to indicate that an optional field is not reported
  const prefix = "gln-"                                   // prefix the repository name must have
  const repoNamePos = 2                                   // position of the repository name in the body of the issue
  const repoDescriptionPos = 6                            // position of the repository description in the body of the issue
  const adminTeamPos = 10                                 // position of the administrators' team in the body of the issue
  const sourceTypePos = 14                                // position of the source type options selector in the body of the issue
  const sourceUrlPos = 18                                 // position of the source url repository in the body of the issue
  const regex = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}/i // regular expression to validate the repository name
  const regSrc = /^([a-z\d]+-)*[a-z\d]+\/([a-z\d]+-)*[a-z\d]+$/i // Regular expresion to validate the source for the repository: org/repo format
  const sourceTypeFork = "fork"                           //Const to identify fork option in the selector in the issue form
  const sourceTypeTemplate = "template"                   //Const to identify template option in the selector selector in the issue form

  let lines = ""
  let repoName = ""
  let repoDescription = ""
  let adminTeam = ""
  let sourceType=""
  let sourceUrl=""

  // initialise a list with the errors found
  let errors = []

  // verify that we have content on the necessary lines
  if (context.payload.issue.body == null) {
    core.setFailed("Issue body is empty.")
    errors.push("The issue body does not have the required information, modify the issue")
  } else {
    // there is content in the body of the issue, we process it
    lines = context.payload.issue.body.split("\n")
    repoName = lines[repoNamePos].trim()
    repoDescription = lines[repoDescriptionPos].trim()
    adminTeam = lines[adminTeamPos].trim()
    sourceType = lines[sourceTypePos].trim()
    sourceUrl = lines[sourceUrlPos].trim()

    // check that the admin team is informed and exists
    if (adminTeam == noResponse || adminTeam == "") {
      errors.push("Admin team is mandatory, update the issue")
    } else {
      // check that the administrators' team exists in the organization
      try {
        const { data: team } = await github.rest.teams.getByName({
          org: context.repo.owner,
          team_slug: adminTeam
        })
        core.info("Admin team " + adminTeam + " exists in the organization, id: " + team.id)
      } catch (error) {
        errors.push("Admin team " + adminTeam + " does not exist in the organization, update the issue. Error: " + error)
        console.log(error)
      }
    }

    // check that the repository name complies with the requirements and that it does not exist in the organization
    if (!regex.test(repoName) || !repoName.startsWith(prefix)) {
      errors.push("Repository name " + repoName + " does not meet the requirements, update the issue")
    } else {
      // check that the repository does not exist in the organization
      try {
        await github.rest.repos.get({
          owner: context.repo.owner,
          repo: repoName
        })
        errors.push("Repository " + repoName + " already exists in the organization, update the issue")
      } catch (error) {
        core.info("Repository " + repoName + " does not exist in the organization")
      }
    }

    // check if the source type is informed. If so, the source url needs to be gather and it becomes a mandatory field
    if (lines[sourceTypePos].trim() != "None" && lines[sourceTypePos].trim() != "") {
      if (lines[sourceUrlPos].trim() == noResponse || lines[sourceUrlPos].trim() == "") {
        errors.push("If you choose " + sourceType + ", source url is mandatory, update the issue")
      }else if (!regSrc.test(sourceUrl)) {
          errors.push("Source url " + sourceUrl + " does not meet the requirements, update the issue")
      }else{
        // source url is format compliance, checking if it exists
        try {
          await github.rest.repos.get({
            owner: sourceUrl.split("/")[0],
            repo: sourceUrl.split("/")[1]
          })
          core.info("Source repository " + sourceUrl + " exists")
        } catch (error) {
          errors.push("Source repository " + sourceUrl.split("/")[0] + "/" + sourceUrl.split("/")[1] + " does not exist, update the issue. Error: " + error)
          console.log(error)
        }
      }
    }
  }

  // process the list of errors from previous validations
  if (errors.length > 0) {
    let body = ""
    for (error of errors) {
      body += ":x: " + error + "\n"
    }
    // create a comment in the issue warning of the error
    await github.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: context.payload.issue.number,
      body: body
    })
    core.setFailed("Error validating issue information to create " + repoName + " in organization " + context.repo.owner + ". Errors: " + errors)
    return
  }

  // we set the value to empty instead of _No reponse_ or _None_ in the optional fields
  if (repoDescription == noResponse) {
    repoDescription = ""
  }
  if (sourceUrl == noResponse) {
    sourceUrl = ""
  }
  if(sourceType == "None"){
    sourceType = ""
  }

  // successful pre-checks, repository can be created
  core.info("Issue number: " + context.payload.issue.number)
  core.info("Repository name: " + repoName)
  core.info("Repository description: " + repoDescription)
  core.info("Admin team: " + adminTeam)
  core.info("Source type: " + sourceType)
  core.info("Source url: " + sourceUrl)
  core.info("Creating repository " + repoName + " in organization " + context.repo.owner)

  try {
    // create the repository in the organization
    let newRepoUrl = ""
    if(sourceType == ""){
      const { data: repo } = await github.rest.repos.createInOrg({
        org: context.repo.owner,
        name: repoName,
        description: repoDescription,
        private: true
      })
      newRepoUrl = repo.html_url
    }else if(sourceType == sourceTypeFork){
      const { data: repo } = await github.rest.repos.createFork({
        owner: sourceUrl.split("/")[0],
        repo: sourceUrl.split("/")[1],
        organization: context.repo.owner,
        name: repoName
      })
      newRepoUrl = repo.html_url
    }else if(sourceType == sourceTypeTemplate){
      const { data: repo } = await github.rest.repos.createUsingTemplate({
        template_owner: sourceUrl.split("/")[0],
        template_repo: sourceUrl.split("/")[1],
        owner: context.repo.owner,
        name: repoName,
        description: repoDescription,
        private: true
      })
      newRepoUrl = repo.html_url
    }else{
      //source option is none of the available, the program should reach this
      core.setFailed("Source type \"" + sourceType + "\" is not valid, update the issue")
      throw "Source type " + sourceType + " is not valid, update the issue"
    }

    core.info("Repository " + repoName + " created in organization " + context.repo.owner + ". URL: " + newRepoUrl)
    core.info("Adding admin team " + adminTeam + " to repository " + repoName + " in organization " + context.repo.owner)

    // add the admin team to the repository
    await github.rest.teams.addOrUpdateRepoPermissionsInOrg({
      org: context.repo.owner,
      team_slug: adminTeam,
      owner: context.repo.owner,
      repo: repoName,
      permission: "admin"
    })

    core.info("Admin team " + adminTeam + " added to repository " + repoName + " in organization " + context.repo.owner)

    // add a comment to the issue indicating that the repository has been created successfully.
    await github.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: context.payload.issue.number,
      body: ":white_check_mark: Repository " + repoName + " created in organization " + context.repo.owner + ". URL: " + newRepoUrl
    })

    // close the issue
    await github.rest.issues.update({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: context.payload.issue.number,
      state: "closed"
    })
  }
  catch (error) {
    core.setFailed("Error creating repository " + repoName + " in organization " + context.repo.owner + ". Error: " + error)
    github.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: context.payload.issue.number,
      body: ":x: Error creating repository " + repoName + " in organization " + context.repo.owner + ". Error: " + error
    })
    console.log(error)
    return
  }
  return repoName
}
