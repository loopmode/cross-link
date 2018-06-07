import glob from 'glob-promise';
import path from 'path';
import fs from 'fs-extra';

export default async function link(definition, { cwd, dryRun = false } = {}) {
    definition = definition.replace(/ -> /, '->');

    let [fromDef, targetDef] = definition.split('->');

    fromDef = path.resolve(`${cwd}/${fromDef}/package.json`);
    targetDef = path.resolve(`${cwd}/${targetDef}`);

    //
    // prepare a list of sources for the symlinks
    // use all folders in the target that have a package.json
    //
    const sourceDirs = await glob(fromDef);
    // console.log({ sourceDirs });
    const sourcePackages = await getValidSources(sourceDirs);

    //
    // prepare a list of valid target folders
    // we will create a symlink to all sourcePackages in each target
    //
    let targetFolders = await glob(targetDef);
    if (!targetFolders.length && targetDef.indexOf('*') === -1) {
        if (!dryRun) await fs.ensureDir(targetDef);
        targetFolders = [targetDef];
    }

    //
    // now create the actual symlinks
    //
    for (let source of sourcePackages) {
        for (let target of targetFolders) {
            if (source.scope) {
                if (!dryRun) {
                    await fs.ensureDir(`${target}/${source.scope}`);
                }
                target = path.resolve(`${target}/${source.scope}/${source.name}`);
            } else {
                target = path.resolve(`${target}/${source.name}`);
            }

            if (dryRun) {
                // const drySource = path.resolve(source.dirname);
                // let dryTarget = path.resolve(target + '/' + source.name);
                console.log('[cross-link] dryRun:', source.dirname, '→', target);
            } else {
                try {
                    if (fs.existsSync(target)) {
                        console.log('[cross-link] found:', source.dirname, '→', target);
                    } else {
                        fs.symlinkSync(source.dirname, target, 'junction');
                        console.log('[cross-link] created:', source.dirname, '→', target);
                    }
                } catch (error) {
                    console.warn(error);
                }
            }
        }
    }
}

async function getValidSources(sources) {
    let result = [];
    for (let source of sources) {
        const dirname = path.dirname(source);
        const exists = await fs.pathExists(dirname);
        if (exists) {
            const { scope, name } = await getPackageInfo(dirname);
            // console.log({ dirname, exists, scope, name });
            result.push({
                dirname,
                scope,
                name
            });
        }
    }
    return result;
}

async function getPackageInfo(dirname) {
    const pkg = await fs.readJson(`${dirname}/package.json`);
    if (pkg.name[0] === '@') {
        const [scope, name] = pkg.name.split('/');
        return { scope, name };
    }
    return { scope: undefined, name: pkg.name };
}