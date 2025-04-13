// --------------------------------------------------------------------------------------
// ThreeJS / Lua Imports

import * as THREE from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js"
import * as luainjs from "lua-in-js"

// --------------------------------------------------------------------------------------
// Editor Plumbing

import ace from "ace-builds"
import "ace-builds/src-noconflict/theme-tomorrow_night"
import "ace-builds/src-noconflict/mode-lua"

var editor = ace.edit("editor")
editor.setTheme("ace/theme/tomorrow_night")
editor.session.setMode("ace/mode/lua")
editor.setHighlightActiveLine(false)
editor.resize()

// --------------------------------------------------------------------------------------
// Querystring nonsense

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

let replicateScript = qs("lua")
if (!replicateScript || replicateScript.length <= 0) {
    replicateScript = "-- Enjoy!\n\nreturn RED\n"
}
editor.setValue(replicateScript, -1)

let startingCubeSize = qs("s")
if (startingCubeSize && startingCubeSize.length > 0) {
    document.getElementById("s").value = startingCubeSize
}

// --------------------------------------------------------------------------------------
// ThreeJS constants/globals and helpers

const CUBE_GEOMETRY = new RoundedBoxGeometry(1, 1, 1)

const PALETTE = [
    null, // unused
    { value: 0xdfe9f5, name: "WHITE" },
    { value: 0x697594, name: "GREY" },
    { value: 0x101517, name: "BLACK" },
    { value: 0xf7aaa8, name: "PEACH" },
    { value: 0xd4689a, name: "PINK" },
    { value: 0x782c96, name: "PURPLE" },
    { value: 0xe83562, name: "RED" },
    { value: 0xf2825c, name: "ORANGE" },
    { value: 0xffc76e, name: "YELLOW" },
    { value: 0x88c44d, name: "LIGHTGREEN" },
    { value: 0x3f9e59, name: "GREEN" },
    { value: 0x373461, name: "DARKBLUE" },
    { value: 0x4854a8, name: "BLUE" },
    { value: 0x7199d9, name: "LIGHTBLUE" },
    { value: 0x9e5252, name: "BROWN" },
    { value: 0x4d2536, name: "DARKBROWN" }
]

function getColorMaterial(paletteIndex) {
    if (paletteIndex < 1 || paletteIndex > PALETTE.length) {
        return null
    }
    const color = PALETTE[paletteIndex]
    if (!color.material) {
        color.material = new THREE.MeshPhongMaterial({
            side: THREE.DoubleSide,
            color: color.value
        })
    }
    return color.material
}

function addCube(scene, x, y, z, paletteIndex) {
    const material = getColorMaterial(paletteIndex)
    if (!material) {
        return
    }
    const cube = new THREE.Mesh(CUBE_GEOMETRY, material)
    cube.position.x = x
    cube.position.y = y
    cube.position.z = z
    scene.add(cube)
}

// --------------------------------------------------------------------------------------
// Lua meat and potatoes

// This sets up the global available to Lua
let LUA_INJECT = `
local abs = math.abs
`
for (let colorIndex = 1; colorIndex < PALETTE.length; ++colorIndex) {
    const color = PALETTE[colorIndex]
    LUA_INJECT += `local ${color.name} = ${colorIndex}\n`
}

window.evalReplicubeScript = function (scene) {
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
    let luaInjectLineCount = 0
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
                let luaInject = LUA_INJECT + luaState
                if (luaInjectLineCount < 1) {
                    luaInjectLineCount = luaInject.split(/\n/).length - 1
                    console.log(`luaInjectLineCount: ${luaInjectLineCount}`)
                }
                let luaScript
                let returnValue
                try {
                    luaScript = luaEnv.parse(luaInject + replicateScript)
                    returnValue = luaScript.exec()
                } catch (parseError) {
                    let errorText = parseError.toString()
                    console.log(errorText)
                    let matches = errorText.match(/SyntaxError: \[(\d+):(\d+)\]/)
                    if (matches) {
                        let row = parseInt(matches[1]) - luaInjectLineCount
                        let col = matches[2]
                        errorText = errorText.replace(/SyntaxError: \[\d+:\d+\]/, `SyntaxError: [${row}:${col}]`)
                    }
                    document.getElementById("error").innerHTML = errorText
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

// --------------------------------------------------------------------------------------
// Initialize ThreeJS renderer/camera

const viewDiv = document.getElementById("view")
const width = viewDiv.clientWidth
const height = viewDiv.clientHeight

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x365987)
const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000)
const renderer = new THREE.WebGLRenderer()
renderer.setSize(width, height)
renderer.setAnimationLoop(() => {
    controls.update()
    renderer.render(scene, camera)
})
viewDiv.appendChild(renderer.domElement)

camera.position.x = 10
camera.position.y = 10
camera.position.z = 20
const controls = new OrbitControls(camera, renderer.domElement)

// --------------------------------------------------------------------------------------
// Hooks for updating querystring, pumping render, responding to dom events

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

window.rebuildScene = () => {
    const cubesizeDiv = document.getElementById("s")
    const cubesizeLabel = document.getElementById("cubesizelabel")
    const cubeSize = parseInt(cubesizeDiv.value)
    cubesizeLabel.innerHTML = `${cubeSize}`
    replicateScript = editor.getValue()

    updatePermalink()
    evalReplicubeScript(scene)
}

window.rebuildScene()
editor.session.on("change", (delta) => {
    rebuildScene()
})

window.onresize = () => {
    location.reload()
}
