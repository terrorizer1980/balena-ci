import { exec } from '@actions/exec';

type Release = {
	id: number;
	isFinal: boolean;
};

type Tag = {
	name: string;
	value: number | string;
};

type BuildOptions = {
	draft: boolean;
	tags: Tag[];
};

const DEFAULT_BUILD_OPTIONS: BuildOptions = {
	draft: true,
	tags: [{ name: 'balena-ci', value: 'true' }],
};

export async function push(
	fleet: string,
	source: string,
	options: Partial<BuildOptions>,
): Promise<string> {
	const pushOpt = ['push', fleet, '--source', source];
	const buildOpt = {
		...DEFAULT_BUILD_OPTIONS,
		...options,
		tags: options.tags
			? options.tags.concat(DEFAULT_BUILD_OPTIONS.tags)
			: DEFAULT_BUILD_OPTIONS.tags,
	};

	if (buildOpt.draft) {
		pushOpt.push('--draft');
	}

	if (buildOpt.tags.length > 0) {
		pushOpt.push('--release-tag');
		for (const tag of buildOpt.tags) {
			pushOpt.push(tag.name);
			pushOpt.push(tag.value.toString());
		}
	}

	let releaseId: string | null = null;

	await exec('balena', pushOpt, {
		listeners: {
			stdout: (data: Buffer) => {
				const msg = data.toString();
				// Using a single regex on each line is preferred but difficult with the colour codes that get sent in the logs
				if (msg.includes('Release:')) {
					releaseId = parseRelease(msg);
				}
			},
		},
	});

	if (releaseId === null) {
		throw new Error('Was unable to find release ID from the build process.');
	}

	return releaseId;
}

export async function getReleasesByTag(
	fleet: string,
	name: string,
	value: number | string,
): Promise<Release[]> {
	console.log(
		`Getting releases for ${fleet} fleet with tag name ${name} equal to ${value}`,
	);
	await sdk.pine.get({
		resource: 'release',
		options: {
			$top: 1,
			$select: ['id', 'is_final'],
			$filter: {
				status: 'success',
				belongs_to__application: {
					$any: {
						$alias: 'bta',
						$expr: {
							bta: {
								slug: 'g_thodoris_greasidis/balenafin',
							},
						},
					},
				},
				release_tag: {
					$any: {
						$alias: 'rt',
						$expr: {
							rt: {
								tag_key: 'balena-ci-pr',
								value: '1234',
							},
						},
					},
				},
			},
			$orderby: { created_at: 'desc' },
		},
	});
	return [{ id: 1910442, isFinal: false }];
}

export async function finalize(releaseId: number): Promise<void> {
	// Send API request to finalize the release
	console.log('Finalizing release : ', releaseId);
	return;
}

function parseRelease(log: string): string | null {
	const idIndex = log.indexOf('id: ');
	const match = log.substr(idIndex).match(/\d{7}/);
	return match ? match[0] : null;
}
