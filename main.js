import * as THREE from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js"
import * as luainjs from "lua-in-js"

function qs(name) {
    name = name.replace(/[\[\]]/g, "\\$&")

    let url = window.location.href
    let regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)")
    let results = regex.exec(url)
    if (!results || !results[2]) {
        return null
    }
    return decodeURIComponent(results[2].replace(/\+/g, " "))
}

var editor = ace.edit("editor")
editor.setTheme("ace/theme/tomorrow_night")
editor.session.setMode("ace/mode/lua")
editor.setHighlightActiveLine(false)
editor.resize()

let replicateScript = qs("lua")
if (!replicateScript || replicateScript.length <= 0) {
    replicateScript = "-- Enjoy!\n\nreturn RED\n"
}
// document.getElementById("lua").value = replicateScript
editor.setValue(replicateScript, -1)

let startingCubeSize = qs("s")
if (startingCubeSize && startingCubeSize.length > 0) {
    document.getElementById("s").value = startingCubeSize
}

const PALETTE = [
    0x000000, // 0 (unused)
    0xdfe9f5, // 1
    0x697594, // 2
    0x101517, // 3
    0xf7aaa8, // 4
    0xd4689a, // 5
    0x782c96, // 6
    0xe83562, // 7
    0xf2825c, // 8
    0xffc76e, // 9
    0x88c44d, // 10
    0x3f9e59, // 11
    0x373461, // 12
    0x4854a8, // 13
    0x7199d9, // 14
    0x9e5252, // 15
    0x4d2536 // 16
]

const luaPrepend = `
local WHITE = 1
local GREY = 2
local BLACK = 3
local PEACH = 4
local PINK = 5
local PURPLE = 6
local RED = 7
local ORANGE = 8
local YELLOW = 9
local LIGHTGREEN = 10
local GREEN = 11
local DARKBLUE = 12
local BLUE = 13
local LIGHTBLUE = 14
local BROWN = 15
local DARKBROWN = 16
local abs = math.abs
`

function createMaterial(paletteIndex) {
    const material = new THREE.MeshPhongMaterial({
        side: THREE.DoubleSide,
        color: PALETTE[paletteIndex]
    })
    return material
}

function addCube(scene, x, y, z, paletteIndex) {
    if (paletteIndex < 1 || paletteIndex > 16) {
        return
    }
    // const geometry = new THREE.BoxGeometry(1, 1, 1)
    const geometry = new RoundedBoxGeometry(1, 1, 1)

    const material = createMaterial(paletteIndex)
    const cube = new THREE.Mesh(geometry, material)
    cube.position.x = x
    cube.position.y = y
    cube.position.z = z
    scene.add(cube)
}

const viewDiv = document.getElementById("view")
const width = viewDiv.clientWidth
const height = viewDiv.clientHeight

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x365987)
const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000)

window.evalReplicubeScript = function () {
    const cubesizeDiv = document.getElementById("s")
    const cubeSize = parseInt(cubesizeDiv.value)

    scene.clear()

    {
        const color = 0xffffff
        const intensity = 3
        const light = new THREE.DirectionalLight(color, intensity)
        light.position.set(-1, 2, 4)
        scene.add(light)
    }

    {
        const color = 0xffffff
        const intensity = 3
        const light = new THREE.DirectionalLight(color, intensity)
        light.position.set(1, -2, -4)
        scene.add(light)
    }

    document.getElementById("error").innerHTML = ""
    for (let x = -cubeSize; x <= cubeSize; ++x) {
        for (let y = -cubeSize; y <= cubeSize; ++y) {
            for (let z = -cubeSize; z <= cubeSize; ++z) {
                const luaEnv = luainjs.createEnv(
                    "", // default value of package.path
                    function () {}, // function that takes in a path and returns a boolean
                    function () {}, // function that takes in a path and returns the content of a file
                    "", // string representing the standard input
                    "", // function representing the standard output
                    function () {} // function called by os.exit
                )
                let luaState = `\nlocal x=${x}\nlocal y=${y}\nlocal z=${z}\n`
                let luaScript
                let returnValue
                try {
                    luaScript = luaEnv.parse(luaPrepend + luaState + replicateScript)
                    returnValue = luaScript.exec()
                } catch (parseError) {
                    console.log(`Parse Error: `, parseError)
                    document.getElementById("error").innerHTML = parseError
                    return
                }
                if (returnValue === undefined || isNaN(returnValue)) {
                    returnValue = 0
                }
                // console.log(`${x},${y},${z}: ${returnValue}`)
                addCube(scene, x, y, z, returnValue)
            }
        }
    }
}

function updatePermalink() {
    let form = document.getElementById("repform")
    let formData = new FormData(form)
    let params = new URLSearchParams(formData)
    params.set("lua", editor.getValue())
    let querystring = params.toString()
    let baseURL = window.location.href.split("#")[0].split("?")[0] // oof hacky
    let newURL = baseURL + "?" + querystring
    history.replaceState("here", "", newURL)
}

window.cubeSizeChanged = function (ev) {
    const cubesizeDiv = document.getElementById("s")
    const cubesizeLabel = document.getElementById("cubesizelabel")
    const cubeSize = parseInt(cubesizeDiv.value)
    cubesizeLabel.innerHTML = `${cubeSize}`
    replicateScript = editor.getValue()

    updatePermalink()
    evalReplicubeScript()
}

const renderer = new THREE.WebGLRenderer()
renderer.setSize(width, height)
renderer.setAnimationLoop(animate)
viewDiv.appendChild(renderer.domElement)

camera.position.x = 10
camera.position.y = 10
camera.position.z = 20
const controls = new OrbitControls(camera, renderer.domElement)

window.cubeSizeChanged()

editor.session.on("change", function (delta) {
    cubeSizeChanged()
})

function animate() {
    controls.update()
    renderer.render(scene, camera)
}
