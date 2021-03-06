import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Grid, Typography } from '@material-ui/core';
import { TitleWrapper } from 'components';

const NotFound: React.FC = (): JSX.Element => {
	const { t, i18n } = useTranslation();
	const { language } = i18n;

	useEffect((): void => window.history.replaceState("", "", `/${language}/404`), []);

	return (
		<TitleWrapper componentName="notFound">
			<Grid container
				direction="row"
				justify="center"
				alignItems="center"
			>
				<Grid item xs>
					<Typography style={{ textAlign: "center", paddingTop: "10vh" }}>{t('notFound.message')}</Typography>
				</Grid>
			</Grid>
		</TitleWrapper>
	);
}

export default NotFound;
