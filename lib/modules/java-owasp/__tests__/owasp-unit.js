'use strict'

/* eslint-disable no-unused-expressions */

const path = require('path')
const exec = require('../../../exec')
const FileManager = require('../../../file-manager')
const { handles, run } = require('..')

describe('Java OWASP Dependency Checker Module', () => {
  const sampleReportFile = path.join(__dirname, './sample/owaspDependencySample.json')
  const simpleJarReportFile = path.join(__dirname, './sample/owaspDependencySimpleJar.json')
  const noIssueReportFile = path.join(__dirname, './sample/owaspDependencySampleNoIssue.json')
  const nonexistentReportFile = path.join(__dirname, './sample/nope.json')

  beforeEach(() => {
    sinon.stub(exec, 'exists').resolves(true)
    sinon.stub(exec, 'command').resolves({ stdout: '' })
  })

  it('should handle maven projects', async () => {
    const fm = new FileManager({ target: path.join(__dirname, './sample/java-maven') })
    expect(await handles(fm)).to.be.true
  })

  it('should handle gradle projects', async () => {
    const fm = new FileManager({ target: path.join(__dirname, './sample/java-gradle') })
    expect(await handles(fm)).to.be.true
  })

  it('should handle kotlin maven projects', async () => {
    const fm = new FileManager({ target: path.join(__dirname, './sample/kotlin-maven') })
    expect(await handles(fm)).to.be.true
  })

  it('should handle kotlin gradle projects', async () => {
    const fm = new FileManager({ target: path.join(__dirname, './sample/kotlin-gradle') })
    expect(await handles(fm)).to.be.true
  })

  it('should handle scala sbt projects', async () => {
    const fm = new FileManager({ target: path.join(__dirname, './sample/scala-sbt') })
    expect(await handles(fm)).to.be.true
  })

  it('should not run on missing executable', async () => {
    exec.exists.resolves(false)
    const fm = new FileManager({ target: path.join(__dirname, './sample/java-gradle') })
    expect(await handles(fm)).to.be.false
  })

  it('should not run on missing jars', async () => {
    const fm = new FileManager({ target: path.join(__dirname, './sample/mvn-with-no-jar') })
    expect(await handles(fm)).to.be.false
  })

  it('should execute dependency check for maven with all required arguments', async () => {
    const target = path.join(__dirname, './sample/java-maven')
    const buildFolder = 'target'
    const fm = new FileManager({ target })

    await run(fm, sampleReportFile)

    expect(exec.command.firstCall.args[0]).to.equal(`dependency-check --noupdate --format JSON --out ${sampleReportFile} -s ${target}/${buildFolder}/main.jar`)
    expect(exec.command.firstCall.args[1]).to.deep.equal({ cwd: target })
  })

  it('should execute dependency check for gradle with all required arguments', async () => {
    const target = path.join(__dirname, './sample/java-gradle')
    const buildFolder = 'build'
    const fm = new FileManager({ target })

    await run(fm, sampleReportFile)

    expect(exec.command.firstCall.args[0]).to.equal(`dependency-check --noupdate --format JSON --out ${sampleReportFile} -s ${target}/${buildFolder}/main.jar`)
    expect(exec.command.firstCall.args[1]).to.deep.equal({ cwd: target })
  })

  it('should execute dependency check for maven scanning supported file types', async () => {
    const target = path.join(__dirname, './sample/java-maven-with-several-artifacts')
    const fm = new FileManager({ target })

    await run(fm, sampleReportFile)

    const cliCommand = exec.command.firstCall.args[0]
    expect(cliCommand).to.have.string(`-s ${target}/target/app.jar`)
    expect(cliCommand).to.have.string(`-s ${target}/target/app.ear`)
    expect(cliCommand).to.have.string(`-s ${target}/target/app.war`)
    expect(cliCommand).to.have.string(`-s ${target}/target/app.jar`)
    expect(cliCommand).to.have.string(`-s ${target}/target/app.apk`)
    expect(cliCommand).to.have.string(`-s ${target}/target/app.tar`)
    expect(cliCommand).to.have.string(`-s ${target}/target/app.gz`)
    expect(cliCommand).to.have.string(`-s ${target}/target/app.tgz`)
    expect(cliCommand).to.have.string(`-s ${target}/target/app.bz2`)
    expect(cliCommand).to.have.string(`-s ${target}/target/app.tbz2`)
    expect(exec.command.firstCall.args[1]).to.deep.equal({ cwd: target })
  })

  it('should execute dependency check with files returned by file manager all() call', async () => {
    const target = path.join(__dirname, './sample/java-maven-with-several-artifacts')
    const fm = new FileManager({ target })
    sinon.spy(fm, 'all')

    await run(fm, sampleReportFile)

    expect(fm.all.firstCall).to.exist
    expect(fm.all.firstCall.calledWithExactly()).to.be.true
  })

  it('should parse issues correctly', async () => {
    const target = path.join(__dirname, './sample/java-maven')
    const fm = new FileManager({ target })

    const { results } = await run(fm, sampleReportFile)

    expect(results.medium).to.deep.contain({
      code: 'java-owasp-CVE-2013-4499',
      offender: 'tw-bnb-backend-0.0.1-SNAPSHOT.jar:mapstruct-1.1.0.Final.jar',
      description: 'https://nvd.nist.gov/vuln/detail/CVE-2013-4499',
      mitigation: 'See the CVE link on the description column.'
    })
  })

  it('should parse issues of a single jar', async () => {
    const target = path.join(__dirname, './sample/java-maven')
    const fm = new FileManager({ target })

    const { results } = await run(fm, simpleJarReportFile)

    expect(results.critical).to.deep.contain({
      code: 'java-owasp-CVE-2017-12621',
      offender: 'buggyjar2.jar',
      description: 'https://nvd.nist.gov/vuln/detail/CVE-2017-12621',
      mitigation: 'See the CVE link on the description column.'
    })
  })

  it('should not report when no issues are present', async () => {
    const target = path.join(__dirname, './sample/java-maven')
    const fm = new FileManager({ target })

    const { results } = await run(fm, noIssueReportFile)

    expect(results.low).to.be.empty
    expect(results.medium).to.be.empty
    expect(results.high).to.be.empty
    expect(results.critical).to.be.empty
  })

  it('should error when dependency check errored', () => {
    const target = path.join(__dirname, './sample/java-maven')
    exec.command = (cmd, pwd, cb) => cb(new Error('some error'))
    const fm = new FileManager({ target })

    return expect(run(fm)).to.be.rejectedWith(Error)
  })

  it('should error when no report present ', () => {
    const target = path.join(__dirname, './sample/java-maven')
    const fm = new FileManager({ target })

    return expect(run(fm, nonexistentReportFile)).to.be.rejectedWith(Error)
  })
})
